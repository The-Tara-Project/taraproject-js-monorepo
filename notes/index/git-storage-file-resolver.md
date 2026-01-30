## Resolver contract

### Inputs

* An **ordered vector** of `(key, value)` pairs.
* Exact match only.
* Keys are strings; values are primitive (string/number/etc).

### Data it operates on

* A **descriptor tape** containing **descriptor records**.
* Each descriptor record is a **flat object** of key→primitive-value pairs.
* Each descriptor record has a **pointer to a file** (commit stream), not to a version.
* Descriptor records are immutable once written.

### Matching semantics

* **Record-level matching**: a record matches the query if it contains *all* pairs in the vector (exact equality on key and value).
* Order of the vector affects performance expectations (users should put selective pairs early), but not correctness.

### Output

* The resolver returns **ALL matching descriptor records**, in full.
* No deduplication by file pointer.
* No ranking, no “best” pick, no ambiguity resolution.

That’s it.

---

## Commit-time resolution policy

When an app calls “commit(descriptor_vector, content)”, git-storage uses the resolver output only to decide where to append.

Your stated policy:

1. Run resolver → get matching descriptor records `R = [r1, r2, ...]`.
2. If `R` is empty:

   * allocate a **new file/stream**
   * write a **new descriptor record** (object form) derived from the commit’s descriptor vector (or from the app’s provided object)
   * append the commit event/version
3. If `R` non-empty:

   * check that **all returned records point to the same file as the first record**
   * if not, **error** (ambiguous stream selection)
   * else append the new version to that file

This gives you a stable, minimal recorder behavior.

---

## Why this stays “simple” and still future-proof

* You can later add:

  * overwrite/supersede descriptors (“current view”) without changing the basic record-level matching idea—just change which records are considered active.
  * indexes that accelerate the same semantics (derived, rebuildable).
  * richer query systems on top without touching the recorder.

Your fallback scan remains the ground truth.

---

## Two small “gotchas” worth writing down now (no extra complexity)

1. **Duplicate keys inside one descriptor record**

   * Since records are “flat objects,” a key must appear at most once.
   * Otherwise record-level matching becomes ill-defined.

2. **Type equality**

   * Exact match should specify whether `"5"` equals `5`.
   * Easiest: they are **not equal** (string vs number are different).

If you lock those in, you avoid subtle future mismatches.
