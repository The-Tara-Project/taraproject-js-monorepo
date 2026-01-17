## Refactor Implementation Plan

## General Instructions
- Generate a plan to refactor the Tara Tape implementation as per the new design considerations.
- Tapes will be long files stored in the Tara Home directory.
- So, its implementation should be 'lazy'
- The tape should never hold all records in memory.
- We should read records from disk using an streaming approach.
- output the plan as `notes-live/002-plan.md`.

## Specific Instructions
- Review current implementation of Tara Tape in `packages/dev/src/lib/tape/`.
- Prepare a 5 point questionennaire to clarify any ambiguities.
- Wait for my written answers to the questionnaire before proceeding.
- Based on the answers, finalize the refactor plan with detailed steps and milestones.
- Keep the plan concise and focused on the essential tasks needed to refactor the tape implementation.
- Do not include implementation code in the plan.
- Ensure the plan adheres to the general design principles outlined in `notes-index/taralib-design-principles.md`.
- Include testing and validation steps to ensure the refactored implementation meets the required functionality.
- No backward compatibility is needed; a clean break is acceptable.
- Change only what is necessary to achieve the refactoring.
- Save the final plan in `notes-live/002-plan.md`.

## Code snippet
Implement following this workflow:

```js
tape = new TaraTape(tapeId);        // just a 'handler' object
tape.getPath();                     // get full path of tape file
instantiateTape(tape);              // create tape file if not exists, do nothing if exists
readRecords(tape, rec => {
   // process record
   return 'stop' | void;            // control iteration
});                                 // lazy iteration of records from disk
rec = createRecord(data);           // create record object in memory
appendRecord(tape, rec);            // append record to tape on disk
appendRecordBatch(tape, [rec]);     // append records to tape on disk
// ...
```
