## Plan for adding Git-Storage support to tara-puller

## General goal
- Update `packages/vscode-tara-puller-extenssion` to support Git-Storage as a storage backend.
- Once a question is submitted via tara-puller, it "discover" a context.
- It peek what is going on in vscode
    - eg. opened files, focused file
- that is ok, but I will want to backoup the files itself
    - Not only the paths
- Using `tara.global.gitst.commitBatch` we can commit files to a git storage
- and add to the context of the question the git storage ref
    - so that tara can later retrieve the files from git storage


### References
- check `packages/taralib-js/examples/git-storage-example.ts`
- check `packages/taralib-js/src/storage/git/`