## Make the puller load the question from a file at `.taraproject/apps/<app_name>/questions`
- i. create `.taraproject/apps/<app_name>` interface on `taralib-ts`
- ii. make `vscode-tara-puller-001-extension` load one question from the files at `.taraproject/apps/<app_name>/questions` instead of hardcoding it
- peek question randomly from the files in that folder
- I loading fails, skip the pulling for one iteration
- The question `json` can have more datat that just the question
    - for instance, the puller name
- A question file is just a `.json`
- iii. Populate with the first (current) question `What are you doing?`

## Make anothre vscode extension
- A `taralib-extension`
- for the moment, it will just scan the `.taraproject/logs/` for errors and show it to the user as a notification in vecode
- 