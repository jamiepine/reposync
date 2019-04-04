const copyRepo = '../pulse'

// to repos
let repos = [
  'me.notify.native',
  'me.notify.webapp',
  'me.notify.desktop',
  'me.notify.core'
];

// ********************************

const fs = require('fs');
const path = require('path');
const winston = require('winston');
const chalk = require('chalk');
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

console.log('+-------------------------------------------------------+');
console.log('');
console.log(
  chalk.bold(
    `             RepoSync Version ${
      require('./package.json').version
    }`
  )
);
console.log('');
console.log('+-------------------------------------------------------+');

function searchForRepositories() {
  const foundRepos = fs
    .readdirSync(path.resolve('..'))
    .filter(dir => repos.find(repo => repo === dir));

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

function readGitIgnore() {
  return fs
    .readFileSync(path.resolve(`${copyRepo}/.gitignore`), {
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

function destPath(repo, item) {
  return path.resolve(
    `../${repo}/node_modules/${path.basename(path.resolve('.'))}/${item}`
  );
}

function copyFile(file) {
  repos.forEach(repo => {
    try {
      fs.copyFileSync(path.resolve(file), destPath(repo, file));
      log.info(chalk.grey('Copied file: ') + file);
    } catch (error) {
      log.silly(`Copy file ${file} error: ${error}`);
    }
  });
}

function unlinkFile(file) {
  repos.forEach(repo => {
    try {
      fs.unlinkSync(destPath(repo, file));
      log.info(`Deleted file ${file}`);
    } catch (error) {
      log.silly(`Delete file ${file} error: ${error}`);
    }
  });
}

function mkDir(dir) {
  repos.forEach(repo => {
    const dest = destPath(repo, dir);
    if (!fs.existsSync(dest)) {
      try {
        fs.mkdirSync(dest);
        log.info(`Created directory ${dir}`);
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
        log.info(`Deleted directory ${dir}`);
      } catch (error) {
        log.silly(`Delete directory ${dir} error: ${error}`);
      }
    }
  });
}

log.info(chalk.bold.blue('Searching for target directories...'));
repos = searchForRepositories();
log.info(chalk.bold.blue('Synchronising directories...'));

const watcher = chokidar
  .watch(path.resolve(copyRepo), {
    persistent: true,
    ignored: [
      `${copyRepo}/**/.*`, // git and dot files
      `${copyRepo}/sync.js`,
      `${copyRepo}/node_modules`,
      ...readGitIgnore(copyRepo)
    ],
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
    copyFile(file);
  })
  .on('change', file => {
    log.debug(`File ${file} has been changed`);
    copyFile(file);
  })
  .on('unlink', file => {
    log.debug(`File ${file} has been removed`);
    unlinkFile(file);
  })
  .on('addDir', dir => {
    log.debug(`Directory ${dir} has been added`);
    mkDir(dir);
  })
  .on('unlinkDir', dir => {
    log.debug(`Directory ${dir} has been removed`);
    unlinkDir(dir);
  })
  .on('ready', () => {
    log.info(chalk.green.bold('Sync complete.'));
    if (process.env.NODE_ENV === 'production') {
      process.exit(0);
    }
    log.info(chalk.blue('Waiting for changes...'));
    winstonConsole.level = 'debug';
  })
  .on('error', error => {
    log.error(`Watcher error: ${error}`);
  })
  .on('all', event => {
    log.debug(`Event triggered: ${event}`);
  });
