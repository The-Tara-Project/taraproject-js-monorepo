## DOING: always add createdAt on record metadata


## DOING: git-storage addressing system
- when specifying context, it isnatural that must of the data is constant
- example, the git repo identity
- example, the vscode workspace identity
- we need to create an addressing system on git-storage
- wen I have a peice of data that I think is stable, 
- I will storage on git-storage
- but, I want it to ve stable in the sense of path
- I mean, I can add and address to any data as if it is a file on the file system
- but instead of copying the data from a file, I give the content on runtime
- niiice... this path, can be constructed using a hash from selected data
- for instance, a repo indentity, a vscode workspace identity
-- what it is identity?
- a data blob containing stuff we think should not change much...
- the point is, the system should find, given a descriptor, which file in git-storage I am talking about...
- and commit on top of that the new version
- git handle dedup and compression by default, we just need to make the assigment/addressing system
- TODO/ rename git-storage to git-vault


## DOING: contextor
- contextor should provide context sumarization
- I mean, once it returns, we can use contextor to produce an attachment summary
- so, apps can use the raw context data or the summary

## DOING: upgrade tara-puller to use Contextor

## DOING: modify tape metadata record
- the taralib metadata is in __taratape
- but we should allow users to add custom metadata at tape level
- still keeping the __taratape for internal use
- also, move `type` to __tararecord metadata
- the first record cargo is user define metadata...

## DONE: think Git-Storage System
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