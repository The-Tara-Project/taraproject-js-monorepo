## Two independent mechanisms

You want **(1) caching for speed** and **(2) forced invalidation for robustness**.

So treat each cache entry as having:

* a cached resolver result (the matched descriptor records)
* an **age policy** that decides when to distrust it and rescan

### Age policy options

1. **TTL (time-based)**

* “After 30s / 5min / 1h, ignore cache and rescan once.”

2. **Use-based TTL**

* “After N hits, ignore cache and rescan once.”
  (This matches your “invalidate after 100 uses”.)

3. **Hybrid**

* Rescan if either TTL expired or uses exceeded.

Hybrid is often best while still simple.

## What “invalidate” should do

Important nuance: invalidation shouldn’t necessarily *delete* the entry. It can mean:

* on the next access after expiry:

  * perform a rescan
  * update the cached value
  * reset counters/timers

This gives you:

* periodic refresh
* hot queries stay hot
* no churn from constantly removing and re-adding

## What to cache (minimal)

Since your resolver returns **descriptor records**, cache exactly that list.

* `queryhash → [descriptorRecordPointers...]`

You don’t need to dedupe by file or enforce commit rules here; that stays outside.

## What guarantees you get (informal, matches your intent)

* Cache may be stale between refreshes.
* Staleness is bounded by TTL/uses.
* Apps are responsible for sensible descriptors and handling ambiguity/errors.

That’s consistent with your “robust but not strongly guaranteed” goal.

## One tiny safety improvement that costs almost nothing

Even with weak guarantees, commit is the “dangerous” path. You can make it safer with one extra rule:

* If cached result has **exactly 1 record**, use it.
* If cached result has **>1 records**, don’t trust cache—force rescan immediately.

Why? Because ambiguity is where stale data hurts most, and rescanning ambiguous cases is cheap insurance.

(Still not “strong guarantees”, just a practical guardrail.)

## Suggested starting defaults

* Cache size: 10,000 entries ✅
* Use-based refresh: 100 uses ✅
* Time-based refresh: optional 5–30 minutes (helps when a query is hot but the world changes)
* Ambiguous results: always rescan on commit

