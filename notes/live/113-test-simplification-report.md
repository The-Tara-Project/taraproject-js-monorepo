# Test Simplification Report

Based on the analysis of `packages/taralib-js/test/**` suite, here are the 5 lowest-value tests with recommendations for improvement, following the criteria defined in `notes/workflows/test.simplyfication.md`.

---

**1. `tape.spec.ts` -> `describe('directory layout', ...)` -> `it('uses tapes/<tapeId>/<YYYYMM>-<tapeId>.tara.jsonl path')`**
- **Score**: 45
- **Triggered rules**: A1, B2, D2
  - **Evidence**: This test asserts the exact file path and naming convention for tape files (`expect(tapePath).toContain(path.join('tapes', testTapeId))`). This is a brittle implementation detail, not a public contract.
- **Recommendation**: ELIMINATE
    - #EXECUTED
- **Proposed change**:
  - **Eliminate the test.** The public contract is that a tape can be created and retrieved by its ID. The underlying file structure is an internal detail and should be allowed to change without breaking tests. This behavior is already covered by integration tests like `integration.spec.ts`.

---

**2. `home.spec.ts` -> `describe('defaultPath', ...)` -> `it('returns ~/.taraproject')`**
- **Score**: 45
- **Triggered rules**: A1, B2, D2
  - **Evidence**: This test asserts the static `HomeManager.defaultPath()` returns the exact string `~/.taraproject`. This makes the test brittle; the default path is an implementation detail that could change.
- **Recommendation**: ELIMINATE
- **Proposed change**:
  - **Eliminate the test.** The critical behavior is that a consistent default path is used when `TARA_HOME` is not set. This is implicitly verified by nearly all other tests that use `setupTestEnv()` without providing a custom home directory. The exact string value is not the contract.

---

**3. `git-handler.spec.ts` -> `describe('instanciate', ...)` -> `it('should initialize a git repository')`**
- **Score**: 40
- **Triggered rules**: A1, A3, D2
  - **Evidence**: The test directly instantiates `GitHandler` (A1) and asserts an implementation detail by checking for the existence of a `.git` directory using `fs.existsSync` (A3). This adds little value over the next test.
- **Recommendation**: ELIMINATE
- **Proposed change**:
  - **Eliminate the test.** Its purpose is fully covered by the subsequent test, `'should return true after instanciate()'`, which correctly verifies the state change by calling the public method `checkInsideWorkingTree()` instead of inspecting the file system directly. This makes the test suite more robust and less coupled to the implementation.

---

**4. `git-storage.spec.ts` -> `describe('Path Mapping', ...)` -> `it('uses hash-based directory structure')`**
- **Score**: 55
- **Triggered rules**: A3, B2, C2
  - **Evidence**: The test calculates an SHA256 hash to verify the exact storage path of a committed file. This is extremely brittle (B2) and tests a pure implementation detail (A3).
- **Recommendation**: SIMPLIFY
- **Proposed change**:
  - Replace the test with one that verifies the end-to-end contract: a file that is committed can be successfully retrieved. The internal storage mechanism should not be tested directly.
  ```typescript
  // Proposed Rewrite (Illustrative)
  it('allows retrieval of a committed file', async () => {
    // ARRANGE: Create a file with unique content
    const originalContent = `content-${Date.now()}`;
    const testFile = path.join(tara.global.home.getHomePath(), 'retrieval-test.txt');
    fs.writeFileSync(testFile, originalContent);

    // ACT: Commit the file to get a link
    const link = await tara.global.gitst.commit(testFile);

    // ASSERT: Use the link to retrieve the content and verify it
    // (Note: Assumes a retrieval function exists or will be created)
    const retrievedContent = await tara.global.gitst.retrieve(link);
    expect(retrievedContent).toBe(originalContent);
  });
  ```

---

**5. `git-storage.spec.ts` -> `describe('Auto Repo Assignment', ...)` -> `it('cache eviction + tape scan re-discovers assignment')`**
- **Score**: 55
- **Triggered rules**: A1, A3
  - **Evidence**: The test uses a `@ts-expect-error` to access and clear a private cache (`tara.global.gitst.assignment.repoCache.clear()`). This is a major violation of encapsulation and creates a test that is tightly coupled to the internal state.
- **Recommendation**: SIMPLIFY
- **Proposed change**:
  - Rewrite the test to simulate a "cold start" without manipulating private state. This can be done by creating a new `TaraStack` instance pointing to the same home directory, which will naturally have an empty in-memory cache.
  ```typescript
  // Proposed Rewrite
  it('assigns files from the same directory to the same repo across sessions', async () => {
    const homeDir = tara.global.home.getHomePath();
    const projectDir = path.join(homeDir, 'my-project');
    fs.mkdirSync(projectDir);
    const file1 = path.join(projectDir, 'a.txt');
    fs.writeFileSync(file1, 'data');

    // "Session 1"
    const link1 = await tara.global.gitst.commit(file1);

    // "Session 2" (new instance, same home)
    const newTaraInstance = new TaraStack({ taraHome: homeDir });
    const file2 = path.join(projectDir, 'b.txt');
    fs.writeFileSync(file2, 'more-data');
    const link2 = await newTaraInstance.global.gitst.commit(file2);

    // ASSERT: Both commits were assigned to the same repository
    expect(link2.repoId).toBe(link1.repoId);
  });
  ```