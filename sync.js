
// ********************************
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const chalk = require('chalk');
const rimraf = require("rimraf");
const logUpdate = require('log-update');

const ignoredIgnores = []

const winstonConsole = new winston.transports.Console({
  level: 'info'
});
const log = winston.createLogger({
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    verbose: 3,
    debug: 4,
    silly: 5
  },
  format: winston.format.combine(
    winston.format.cli(),
    winston.format.timestamp(),
    winston.format.printf(info => `${info.level}: ${info.message}`)
  ),
  transports: [winstonConsole]
});
const chokidar = require('chokidar');
const eol = require('os').EOL;

module.exports = function sync(watchRepos = [], repos = [], watch = true) {

console.log('+-------------------------------------------------------+');
console.log('');
console.log(
  chalk.bold(
    `                RepoSync Version ${
      require('./package.json').version
    }`
  )
);
console.log('');
console.log('+-------------------------------------------------------+');

function searchForRepositories() {
  const foundRepos = []
  // fs
  //   .readdirSync(path.resolve(`${repo}`))
  //   .filter(dir => repos.find(repo => repo === dir));

  for (let _repo of repos) {
    let _found = path.resolve(`${_repo}`)
    if (_found) foundRepos.push(_found)
  }

  if (foundRepos.length === 0) {
    log.error('No repositories found');
  } else {
    log.info(
      chalk.bold.green('Found repositories: ') +
        foundRepos.map(repo => `${eol}  ${repo}`).join('')
    );
  }

  return foundRepos;
}

function readGitIgnore(_path) {
  if (!fs.existsSync(path.resolve(`${_path}/.gitignore`))) return false;

  return fs
  .readFileSync(path.resolve(`${_path}/.gitignore`), {
    encoding: 'utf-8'
  })
  .split(eol)
  .map(item => item.trim())
  .filter(item => item.length > 0 && item.indexOf('#') === -1)
  .filter(item => {
    return item !== 'dist'
  })
  .map(item =>
    item.charAt(item.length - 1) === '/'
      ? item.substr(0, item.length - 1)
      : item
  );
}
function readRepoSyncIgnore(_path) {
  if (!fs.existsSync(path.resolve(`${_path}/.reposyncignore`))) return false;

  return fs
  .readFileSync(path.resolve(`${_path}/.reposyncignore`), {
    encoding: 'utf-8'
  })
  .split(eol)
  .map(item => item.trim())
  .filter(item => item.length > 0 && item.indexOf('#') === -1)
  .map(item =>
    item.charAt(item.length - 1) === '/'
      ? item.substr(0, item.length - 1)
      : item
  );
}

function cleanDirectories() {
  return new Promise(async (resolve) => {
    // for the dest repos
    for (let repo of repos) {
      for (let destPath of watchRepos) {
        let x = destPath.split('/');
        let repoName = x[x.length - 1];
        let key = `${repo}/${repoName}`;
        logUpdate(key);
        await rimraf.sync(key);
      }
    }
    logUpdate('done')
    resolve()
  })
}

function destPath(repo, item) {
  return path.resolve(
    `${repo}/${path.basename(path.resolve('.'))}/${item}`
  );
}

 function copyFile(file, _watch) {
  repos.forEach(repo => {
    try {
      let watchDirectory = _watch.split('/');
      watchDirectory.pop(); 
      let fileName = `../${file.split(`${watchDirectory.join('/')}/`)[1]}`;
      fs.copyFileSync(path.resolve(file), destPath(repo, fileName));
      logUpdate(chalk.grey('Copied file: ') + file);
    } catch (error) {
      log.silly(`Copy file ${file} error: ${error}`);
    }
  });
}

function unlinkFile(file) {
  repos.forEach(repo => {
    try {
      fs.unlinkSync(destPath(repo, file));
      logUpdate(`Deleted file ${file}`);
    } catch (error) {
      log.silly(`Delete file ${file} error: ${error}`);
    }
  });
}

function mkDir(dir, _watch) {
  repos.forEach(repo => {
    let watchDirectory = _watch.split('/');
    watchDirectory.pop(); 
    let dirName = `../${dir.split(`${watchDirectory.join('/')}/`)[1]}`;

    const dest = destPath(repo, dirName);
    if (!fs.existsSync(dest)) {
      try {
        fs.mkdirSync(dest);
        logUpdate(`${chalk.grey('Created directory')} ${dir}`);
      } catch (error) {
        log.silly(`Create directory ${dir} error: ${error}`);
      }
    }
  });
}

function unlinkDir(dir) {
  repos.forEach(repo => {
    const dest = destPath(repo, dir);
    if (fs.existsSync(dest)) {
      try {
        fs.rmdirSync(dest);
        logUpdate(`Deleted directory ${dir}`);
      } catch (error) {
        log.silly(`Delete directory ${dir} error: ${error}`);
      }
    }
  });
}

let _done = false
function done() {
  if (!_done) {
    setTimeout(() => {
      log.info(chalk.yellow('Waiting for changes...'));
    }, 1000);
    _done = true
  }
}

async function run() {
  log.info(chalk.bold.blue('Searching for target directories...'));
  repos = searchForRepositories();
  log.info(chalk.bold.blue('Cleaning directories...'));
  await cleanDirectories();
  log.info(chalk.bold.blue('Synchronising directories...'));



for (let _watch of watchRepos) {
  let ignored = [
    `${_watch}/**/.*`, // git and dot files
    `${_watch}/sync.js`,
    `${_watch}/node_modules`,
  ];

  if (!ignoredIgnores.includes(_watch)) {
    let x = readGitIgnore(_watch);
    x = [...x, ...(readRepoSyncIgnore(_watch) || [])];
    if (x) {
      x.forEach(thing => {
        ignored.push(`${_watch}/${thing}`);
      })
    }
  }

  chokidar
    .watch(path.resolve(_watch), {
      persistent: true,
      ignored,
      ignoreInitial: false,
      followSymlinks: false,
      cwd: path.resolve('.'),
      disableGlobbing: false,
      usePolling: true,
      interval: 100,
      binaryInterval: 300,
      alwaysStat: false,
      depth: 99,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      },
      ignorePermissionErrors: false,
      atomic: true // or a custom 'atomicity delay', in milliseconds (default 100)
    })
    .on('add', file => {
      log.debug(`File ${file} has been added`);
      copyFile(file, _watch);
      logUpdate('')
    })
    .on('change', file => {
      log.debug(`File ${file} has been changed`);
      copyFile(file, _watch);
    })
    .on('unlink', file => {
      log.debug(`File ${file} has been removed`);
      unlinkFile(file);
    })
    .on('addDir', dir => {
      log.debug(`Directory ${dir} has been added`);
      mkDir(dir, _watch);
    })
    .on('unlinkDir', dir => {
      log.debug(`Directory ${dir} has been removed`);
      unlinkDir(dir);
    })
    .on('ready', () => {
      if (process.env.NODE_ENV === 'production' || !watch) {
        process.exit(0);
      }
      setTimeout(() => {
          log.info(`${chalk.bold.blue('Sync complete')} (${chalk.green.bold(`${_watch}`)})`);
          
          done()
          winstonConsole.level = 'debug';
      }, 1000);
    })
    .on('error', error => {
      log.error(`Watcher error: ${error}`);
    })
    .on('all', event => {
      // log.debug(`Event triggered: ${event}`);
    });
  }
}

  run()
}