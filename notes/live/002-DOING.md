## DOING: think Git-Storage System
- make Git-Storage a reusable system
- we can deplay a Git-Storage system on any folder
- the current git-storage is just an instance
- the principle is simple, a folder with repos at subfolder level...

- Define purpose of `~/.taraproject/git-storage`
    - Rename:`~/.taraproject/git-storage` -> `~/.taraproject/vault`
- Make track `~/.taraproject/tapes` as a git-storage

## DOING: think about taraprojects
- a folder with a `taraproject.json` inside
- we can add a uuid to identify each project
- we can force to operate only inside a taraproject
- if the folder is renamed, the uuid remains the same


## DOING: think about git-storage links
- should they include full path or just relative?

## DONE: Refactor sub-handlers to load dynamically
- sun-handler will be undefined until first used
- use getters to load them on demand
- this will speed up the instantiation of handlers

## DONE: Make the puller load the question from a file at `.taraproject/apps/<app_name>/questions`
- i. create `.taraproject/apps/<app_name>` interface on `taralib-ts`
- ii. make `vscode-tara-puller-001-extension` load one question from the files at `.taraproject/apps/<app_name>/questions` instead of hardcoding it
- peek question randomly from the files in that folder
- I loading fails, skip the pulling for one iteration
- The question `json` can have more datat that just the question
    - for instance, the puller name
- A question file is just a `.json`
- iii. Populate with the first (current) question `What are you doing?`

## DONE: Make another vscode extension
- A `taralib-extension`
- for the moment, it will just scan the `.taraproject/logs/` for errors and show it to the user as a notification in vecode
- 