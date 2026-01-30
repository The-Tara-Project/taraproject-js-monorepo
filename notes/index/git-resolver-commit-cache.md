### Cache system note (hybrid invalidation)

#### Purpose

The cache accelerates the resolver by memorizing results for frequently repeated descriptor queries. It is **purely a derived optimization**: correctness never depends on the cache. If the cache is missing, stale, or corrupted, the system falls back to the canonical tape scan / index-backed resolution and behaves the same.

#### Scope

* The cache is designed to speed up **resolution**, especially on the commit path where the same descriptor vectors are often reused.
* The cache stores **hits only** (queries that matched ≥1 descriptor record).
  Rationale: for commit workflows, a miss typically results in creating a new file + descriptor record, so repeated misses should be uncommon and not worth caching.

#### Key and value

* **Cache key:** `queryHash`, computed from the **ordered descriptor vector** `[(k1,v1), (k2,v2), …]`.

  * Order is significant.
  * Keys and values must be hashed exactly as provided (exact-match semantics), including type distinctions (e.g., `"5"` ≠ `5`).
* **Cache value:** the resolver output for that query, i.e. the **full list of matching descriptor records** (as pointers/identifiers to those records).

  * The cache does not deduplicate by file pointer and does not attempt to “choose the best” match. It mirrors resolver semantics.

#### Hybrid invalidation policy

Each cache entry is automatically treated as stale and forced to refresh based on a hybrid policy:

1. **Time-based TTL:** an entry expires after a configured wall-clock duration since its last refresh (e.g., 5–30 minutes).
2. **Use-based TTL:** an entry expires after a configured number of cache hits since its last refresh (e.g., 100 uses).

When either threshold is exceeded, the next access triggers a **refresh**:

* perform a normal resolution (index-backed if available; otherwise tape scan),
* overwrite the cached value with the new result,
* reset the entry’s TTL timestamp and use counter.

This bounds staleness without requiring strong global coordination.

#### Capacity and eviction

* The cache holds up to a fixed number of entries (e.g., **10,000**).
* When full, entries are evicted using a simple policy (typically **LRU**), independent of TTL refresh.
  TTL refresh controls correctness/robustness; eviction controls memory.

#### Commit-path usage

On commit, the cache is used as an acceleration layer:

* If a valid cache entry exists, its stored resolver result is returned immediately.
* If the entry is expired (by time or use count), the system refreshes it first, then continues.
* Commit-time ambiguity handling remains the responsibility of the commit logic (e.g., error if matched descriptor records point to different files). The cache does not change this behavior; it only supplies results faster.

#### Non-goals

* The cache is **not** a general query system.
* The cache does **not** provide strong guarantees against concurrent writers or rapidly changing descriptor tapes. It offers bounded staleness via refresh rules, and downstream apps remain responsible for handling ambiguity safely.
