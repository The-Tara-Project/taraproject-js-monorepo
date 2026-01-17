## General Goals
Tara integrates with Git on its home depot.
I need basic git infrastructure for that.
The feature surface is minimal now:
- initialize a git repo at a path
- always check path is under expected git repo
- commit changes with a generated message
    - use 
        * `git rev-parse --is-inside-work-tree`
        * `git rev-parse --show-toplevel`
- add All to staging
    * `git add -A`
- commit changes with a message
    * `git commit -m "<message>"`


## Insructions
- research for a simple ts/js git library that can do the above
- read `notes-index/index.md` for context









Good, now we’re firmly in *git-as-a-system* territory.

I’ll answer in two layers:

1. **What concrete git command combinations are being used (conceptually)**
2. **Which classic git problems this workflow solves, and why this combination works**

I’ll stay descriptive, not procedural, and tie everything back to intent.

---

