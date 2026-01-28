## strict write, relax read principle

- at writting, the system will check and enforce all inerfaces
    - the goal is that data is always written in a valid state
- at reading, the system don't care about interfaces
    - the goal is to be more flexible and tolerant to changes
    - for example, if a new field is added to a data structure, old readers can still read the data without issues
    - same that for resolving context, fomats and wrokflows most be solved by the system given the data...

### advantages
- this principle is useful in systems where data integrity is crucial, but backward compatibility is also important
- it allows for evolution of data structures without breaking existing functionality