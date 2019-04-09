Edit first lines of sync.js to choose the directories to watch and which repositories to copy to. Paths are relative to this sync script.

```
// copy & watch repos
const watchRepos = ['../repoOne']

// to repos
let repos = ['../repoTwo'];
```

Above will move the files inside "repoOne" into "repoTwo/node_modules/repoOne"

The .git_ignore in "repoOne" is read and respected when copying files.
