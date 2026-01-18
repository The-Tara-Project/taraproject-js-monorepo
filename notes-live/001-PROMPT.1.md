## General

Hi, I want to modify the current implementation of `TaraTapeHandler`
- I want to have separation of concerns
    - I want a `TaraFileTapeHandler` that handles file operations
    - I want a `TaraGitHandler` that handles git operations
- that is, I want to unlock workflows like
    - `tape.fileHandler.appendRecords(...)`
    - `tape.gitHandler.commitChanges(...)`
- I like this because is more extensible and easier to maintain

## Task

- lets have discussion/chat about the design principles
- we will iterate
    - find 5 from the more relevent design questions about the task
    - wait for my (written) response 
    - repeat till I say we are good to go
- then write the plan
