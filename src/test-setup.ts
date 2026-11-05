import '@testing-library/jest-dom/vitest'

// JSDOM does not use native Node Blobs, so Node's native structuredClone
// (used by fake-indexeddb) treats JSDOM Blobs as plain objects.
// This shim preserves Blobs and Files across structuredClone in the test environment.
if (typeof globalThis.structuredClone === 'function') {
  const nativeStructuredClone = globalThis.structuredClone
  function cloneWithBlobs<T>(val: T): T {
    if (val === null || typeof val !== 'object') return val
    if (
      val.constructor &&
      (val.constructor.name === 'Blob' || val.constructor.name === 'File') &&
      typeof (val as unknown as Blob).slice === 'function'
    ) {
      return (val as unknown as Blob).slice() as unknown as T
    }
    if (Array.isArray(val)) {
      return val.map((item) => cloneWithBlobs(item)) as unknown as T
    }
    if (Object.prototype.toString.call(val) === '[object Object]') {
      const res: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(val)) {
        res[k] = cloneWithBlobs(v)
      }
      return res as T
    }
    try {
      return nativeStructuredClone(val)
    } catch {
      return val
    }
  }
  globalThis.structuredClone = cloneWithBlobs
}
