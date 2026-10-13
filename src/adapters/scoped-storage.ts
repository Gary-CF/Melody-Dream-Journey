export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** An explicit namespace, never a global Storage.prototype patch. */
export function createScopedStorage(
  store: KeyValueStore,
  namespace = "",
): KeyValueStore {
  if (namespace.length > 100 || /[\u0000-\u001f]/.test(namespace))
    throw Error("Invalid storage namespace");
  return {
    getItem: (key) => store.getItem(namespace + key),
    setItem: (key, value) => store.setItem(namespace + key, value),
    removeItem: (key) => store.removeItem(namespace + key),
  };
}

export function createBrowserStorage(): KeyValueStore {
  const namespace =
    document.querySelector<HTMLMetaElement>(
      'meta[name="journey-storage-namespace"]',
    )?.content ?? "";
  // Access lazily: browser storage may be unavailable; existing callers retain
  // their own error handling rather than silently losing an attempted save.
  return createScopedStorage(
    {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
      removeItem: (key) => localStorage.removeItem(key),
    },
    namespace,
  );
}
