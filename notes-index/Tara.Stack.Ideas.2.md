## commit integration
check: https://github.com/ghuntley/loom/blob/trunk/specs/auto-commit-system.md

## Extensible metadata
**option 1**
- On creation, for any object with metadata (tapes, records, etc)
- we should allow passing extra metadata fields as a generic object.
- This metadata should be stored alongside the standard metadata.
- once written, it is still immutable.
**option 2**
- Keep the basic metadata as is
- upsteam systems should use regular records to store extra metadata

## Apps: What are you doing (WAUDing)
- make trigering policy clear
    - fully configurable
- Add some cross vscode integration
    - before pulling, the app read the tape
    - if an answer (no a dismmiss) was recorded reciently, skip
- make skip policy clear
    - fully configurable
- make this the offitial tara puller
    - rename to TaraPuller-vscode
- other apps can register questions hooks
    - define how this works

## Apps: Configuration
- where to put apps configuration?
- One place is the `TARA_HOME/apps/<pluggin-id>` folder

## Apps: Pluggin class
- make a pluggin class for all pluggings in js/ts to use
    - But it should not be required
    - the interface should be file based

## Apps: Manifest
- define what apps must discluse on `.taraproject`

## Data Structs: TempTape, FreeRecords, TaraPort
**Rationale**
- We need also cheap data utilities
- For instance, If we really want to be multi language
- the tara stack should provide File based Addapters
    - For vscode for instance
- Or at leat a place where too publicly place data
    - like a port system
- This tapes are not intended to be long term
- It is just a place for apps to 
    - listen what we are doing in vscode
- All of this should be deployed as need it
- as simple as posible always implementing just the final layer if possible
- I think for now, text base is the wait to go...

## Top level class
- just like the obsidian class
- A top level class connected with all subsystems
- how to name it
    - just `Tara`
    - `TaraProj`
    - `TaraStack`

## PC level context recorder
- Juts a recorder of what is happening
- let say every minute
- use whatever means to get
    - what is open 
    - what is active
    - as much details as posible
- applications can ask for closest record
    - and add a link to its context
- recording can be independent or by request
- A simple first implementation can just return closest context
    - and record on intervals
- this can be a single app or several
- Also, this workflow can be general to all autonomic context recorders

## Service: Context Recorders
- And special type of app is a context recorder
- usage case
- For instace, pullers can only care about minimal close to pull station context
    - For instance, vscode quick enviroment
- but, readers can use the time stamp to query Context Recorders
    - and get more broad data
- For instance, a file tracker which follow all changed files 
- when this is in place, non context recorders can check if it is necesary to emmbed direct context into their records
- this can make more effitiant 
- Also, an App can send a Context record request
    - to record uptoday context data

## Servide: GitArchive
- For selected files, we want a granular full tracking 
- we will take frequent snapshots
- all the Archive will be under a single repo
    - we deal with scale problems later
- Similar to context recorders, an app can ask for a snapshot
    - It can ask for a new one, or the closest one
- of course, the service mantain a tape with all snapshots produced
- Usage case, behaviour study of user workflows

## Servise: folder tracker
- Follow file metadata in selected forlders
-- for instance, `Downloads`, `Documents`
- It is a lite recorder, just metadata
- include hash for dicovery
- triggered on file changed

## TaraPuller
- make that I can use the arrows to access previous msgs
- Add bottoms to increase/decrease frequency
- Add notification 5 seconds before pulling
- Add notification on every new entry