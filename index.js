const sync = require('./sync')
const config = require('./config.json');

let watch = !!process.argv.find(x => x == '--watch')

config.instances.forEach(instance => {
    sync(instance.fromDirectories, instance.toDirectories, watch)
});
