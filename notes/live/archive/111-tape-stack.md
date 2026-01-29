# Tape Ecosystem Specification

## Responsibility Classification
  
### Manager Layer (GTapeManager)

Scope: Collection/Stack operations - operates on "all/any tapes"

Collection Queries
- List all tape IDs
- Check if tape exists by ID
- Delete tape by ID
- Build tape file path (internal factory logic)
  
Handler Factory   
- Create/setup handler instances for tape ID 
  
--- 
## Handler Layer (GTapeHandler)
Scope: Instance operations - operates on "this tape" 

Identity & Location
- Get tape ID 
- Get tape metadata
- Get tape file path 
  
Lifecycle (File Operations) 
  
- Instantiate tape (create file + metadata)   
- Check if tape exists (instance level)
- Delete tape (instance level)  
  
Data Operations (Records)
  
- Append record   
- Append record batch
- Read all records
- Read metadata   
  
--- 
Notes
  
- Manager and Handler each have exists() and delete() - different semantic levels
- Manager: "Does tape with ID X exist in the collection?" 
- Handler: "Does THIS tape instance exist?" 
- Handler is a pure container/coordinator 
- No wrapper convenience methods 
- Manager is the preferred way to obtain handler instances
- get(tapeId) factory method  
- No separate create() convenience - user calls get(...).fileHandler.instantiate()