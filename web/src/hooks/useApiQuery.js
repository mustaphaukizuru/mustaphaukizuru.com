// ─────────────────────────────────────────────────────────────────────────────
// useApiQuery · ONE data-fetching hook for the member dashboard
//
// Why this exists:
//   Every dashboard page hand-rolled the same useEffect + setLoading +
//   setError + `cancelled` flag dance. This hook centralises it, adds a tiny
//   in-memory cache so back-navigation is instant, dedupes concurrent
//   requests for the same key, and cancels on unmount. No external deps.
//
// Usage:
//   const orders = useApiQuery("orders", () => fetchMyOrders())
//   orders.data      — resolved value (undefined until first success)
//   orders.error     — sanitised message string ("" when none)
//   orders.loading   — true only while there is NO data to show yet
//   orders.fetching  — true while any request for this key is in flight
//   orders.refetch() — force a network refresh (bypasses staleTime)
//   orders.setData(next | (prev) => next) — local/optimistic update, also
//                     written to the cache so other subscribers see it
//
//   useApiQuery(`order:${id}`, ({ signal }) => fetchMyOrderById(id), {
//     enabled: Boolean(id),   // skip while the input isn't ready
//     staleTime: 60_000,      // cached entries are reused for this long
//     select: (res) => res.data, // optional normaliser
//   })
//
//   invalidateQueries("orders")   — drop every cached key starting with
//                                   "orders"; mounted subscribers refetch.
//   setQueryData(key, updater)    — write to the cache from anywhere
//                                   (e.g. after a mutation elsewhere).
//
// Fetchers receive `{ signal }` (an AbortSignal) — pass it through to
// lib/api.js helpers when you can; when you can't, the hook still ignores
// results that arrive after the component unmounted or the key changed.
//
// useApiMutation(fn, { onSuccess, invalidate }) is the write-side sibling:
//   const save = useApiMutation((form) => updateAddress(form.id, form), {
//     invalidate: ["addresses"],
//   })
//   await save.mutate(form)   // save.loading / save.error
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react"

const DEFAULT_STALE_MS = 60_000

/** key -> { data, updatedAt, promise, subscribers:Set<fn> } */
const cache = new Map()

function entryFor(key) {
  let entry = cache.get(key)
  if (!entry) {
    entry = { data: undefined, updatedAt: 0, invalidated: false, promise: null, subscribers: new Set() }
    cache.set(key, entry)
  }
  return entry
}

function notify(entry) {
  for (const fn of entry.subscribers) fn()
}

function toMessage(err, fallback) {
  if (!err) return fallback || "Request failed."
  if (typeof err.toUserMessage === "function") return err.toUserMessage()
  return err.message || fallback || "Request failed."
}

function isFresh(entry, staleTime) {
  return entry.updatedAt > 0 && Date.now() - entry.updatedAt < staleTime
}

/* ── Public cache helpers ─────────────────────────────────────────────── */

export function getQueryData(key) {
  return cache.get(key)?.data
}

export function setQueryData(key, updater) {
  const entry = entryFor(key)
  entry.data = typeof updater === "function" ? updater(entry.data) : updater
  entry.updatedAt = Date.now()
  notify(entry)
}

/**
 * Invalidate every cached key that starts with `prefix` (or every key when
 * called without arguments). Mounted subscribers refetch immediately;
 * unmounted keys are dropped so the next mount fetches fresh.
 */
export function invalidateQueries(prefix = "") {
  for (const [key, entry] of cache) {
    if (!key.startsWith(prefix)) continue
    entry.updatedAt = 0
    entry.invalidated = true
    if (entry.subscribers.size === 0) cache.delete(key)
    else notify(entry)
  }
}

/** Run (or join) the request for a key. Dedupes concurrent callers. */
function runFetch(key, fetcher, select) {
  const entry = entryFor(key)
  if (entry.promise) return entry.promise

  const controller = new AbortController()
  entry.invalidated = false
  const promise = Promise.resolve()
    .then(() => fetcher({ signal: controller.signal }))
    .then((raw) => {
      const data = select ? select(raw) : raw
      // A later invalidation or setQueryData wins over this response.
      if (entry.promise === promise) {
        entry.data = data
        entry.updatedAt = Date.now()
      }
      return data
    })
    .finally(() => {
      if (entry.promise === promise) entry.promise = null
      notify(entry)
    })
  promise.abort = () => controller.abort()
  entry.promise = promise
  // Let subscribers flip `fetching` — deferred so an effect that starts a
  // request never sets state synchronously.
  queueMicrotask(() => { if (entry.promise === promise) notify(entry) })
  return promise
}

/* ── useApiQuery ──────────────────────────────────────────────────────── */

export default function useApiQuery(key, fetcher, options = {}) {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_MS,
    select,
    initialData,
  } = options

  // Latest fetcher/select without making them effect deps (callers pass
  // inline arrows). Synced in an effect — declared before the load effect
  // below so it always runs first.
  const fetcherRef = useRef(fetcher)
  const selectRef = useRef(select)
  useEffect(() => {
    fetcherRef.current = fetcher
    selectRef.current = select
  })

  // Snapshot used for render. `key` is stored alongside so a key change
  // can re-derive state during render (React's sanctioned pattern) instead
  // of flashing the previous key's data.
  const snapshot = useCallback((k) => {
    const entry = cache.get(k)
    const data = entry?.data !== undefined ? entry.data : initialData
    return {
      key: k,
      data,
      error: "",
      loading: enabled && data === undefined,
      fetching: Boolean(entry?.promise),
    }
  }, [enabled, initialData])

  const [state, setState] = useState(() => snapshot(key))
  if (state.key !== key) setState(snapshot(key))

  // Kick off (or join) the request. Contains NO synchronous setState so the
  // mount effect can call it directly; results reach state asynchronously
  // through the subscriber callback and the rejection handler.
  const startFetch = useCallback((force = false) => {
    if (!enabled) return Promise.resolve(undefined)
    const entry = entryFor(key)
    if (!force && isFresh(entry, staleTime) && !entry.promise) return Promise.resolve(entry.data)
    return runFetch(key, fetcherRef.current, selectRef.current).then(
      (data) => data,
      (err) => {
        if (err?.name === "AbortError") return undefined
        setState((s) => (s.key === key ? { ...s, error: toMessage(err), loading: false, fetching: false } : s))
        return undefined
      }
    )
  }, [key, enabled, staleTime])

  // Event-handler flavour: reflects the fresh-cache / in-flight state
  // immediately (the render-time snapshot already covers the mount case).
  const load = useCallback((force = false) => {
    if (!enabled) return Promise.resolve(undefined)
    const entry = entryFor(key)
    if (!force && isFresh(entry, staleTime) && !entry.promise) {
      setState((s) => ({ ...s, key, data: entry.data, loading: false, fetching: false, error: "" }))
      return Promise.resolve(entry.data)
    }
    setState((s) => ({ ...s, key, fetching: true, loading: s.data === undefined, error: "" }))
    return startFetch(force)
  }, [key, enabled, staleTime, startFetch])

  useEffect(() => {
    if (!enabled) return undefined
    const entry = entryFor(key)
    let alive = true
    const sync = () => {
      if (!alive) return
      setState((s) => (s.key === key
        ? { ...s, data: entry.data !== undefined ? entry.data : s.data, loading: entry.data === undefined && Boolean(entry.promise), fetching: Boolean(entry.promise) }
        : s))
      // Invalidated while mounted → refetch (a failed fetch does NOT retry).
      if (entry.invalidated && !entry.promise) startFetch(true)
    }
    entry.subscribers.add(sync)
    startFetch()
    return () => {
      alive = false
      entry.subscribers.delete(sync)
      if (entry.subscribers.size === 0 && entry.promise?.abort) {
        // Last subscriber left mid-flight → cancel the network request.
        entry.promise.abort()
        entry.promise = null
      }
    }
  }, [key, enabled, startFetch])

  const refetch = useCallback(() => load(true), [load])

  const setData = useCallback((updater) => {
    setQueryData(key, updater)
    setState((s) => ({ ...s, data: cache.get(key).data, loading: false, error: "" }))
  }, [key])

  return {
    data: state.data,
    error: state.error,
    loading: state.loading,
    fetching: state.fetching,
    refetch,
    setData,
  }
}

/* ── useApiMutation ───────────────────────────────────────────────────── */

export function useApiMutation(mutationFn, options = {}) {
  const { onSuccess, onError, invalidate = [] } = options
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const fnRef = useRef(mutationFn)
  const optsRef = useRef({ onSuccess, onError, invalidate })
  useEffect(() => {
    fnRef.current = mutationFn
    optsRef.current = { onSuccess, onError, invalidate }
  })

  const mutate = useCallback(async (...args) => {
    setLoading(true); setError("")
    try {
      const result = await fnRef.current(...args)
      for (const prefix of optsRef.current.invalidate) invalidateQueries(prefix)
      await optsRef.current.onSuccess?.(result, ...args)
      return result
    } catch (err) {
      const msg = toMessage(err)
      setError(msg)
      optsRef.current.onError?.(err, msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => setError(""), [])

  return { mutate, loading, error, reset }
}
