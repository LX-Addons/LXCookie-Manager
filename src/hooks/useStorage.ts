import { useState, useEffect, useCallback } from "react";
import { storage } from "wxt/utils/storage";

type StorageKey = `local:${string}` | `session:${string}` | `sync:${string}` | `managed:${string}`;

const deepMerge = <T>(defaultValue: T, storedValue: T): T => {
  if (
    typeof defaultValue !== "object" ||
    defaultValue === null ||
    Array.isArray(defaultValue) ||
    typeof storedValue !== "object" ||
    storedValue === null ||
    Array.isArray(storedValue)
  ) {
    return storedValue;
  }

  const result = { ...defaultValue } as Record<string, unknown>;
  const stored = storedValue as Record<string, unknown>;
  const defaults = defaultValue as Record<string, unknown>;

  for (const key of Object.keys(stored)) {
    if (stored[key] !== undefined) {
      if (
        typeof stored[key] === "object" &&
        stored[key] !== null &&
        !Array.isArray(stored[key]) &&
        typeof defaults[key] === "object" &&
        defaults[key] !== null &&
        !Array.isArray(defaults[key])
      ) {
        result[key] = deepMerge(defaults[key], stored[key]);
      } else {
        result[key] = stored[key];
      }
    }
  }

  return result as T;
};

const mergeWithDefault = <T>(defaultValue: T, storedValue: T): T => {
  if (
    typeof storedValue === "object" &&
    storedValue !== null &&
    !Array.isArray(storedValue) &&
    typeof defaultValue === "object" &&
    defaultValue !== null &&
    !Array.isArray(defaultValue)
  ) {
    return deepMerge(defaultValue, storedValue);
  }
  return storedValue;
};

/**
 * A React hook for managing WXT extension storage with automatic sync.
 *
 * @template T - The type of the stored value
 * @param key - The storage key (must be prefixed with storage area: local:, session:, sync:, or managed:)
 * @param defaultValue - The default value to use when no stored value exists.
 *   **IMPORTANT**: This must be a stable reference (module-level constant or memoized value).
 *   Passing inline object/array literals will cause unnecessary re-renders and effect re-runs.
 *   Example: `useStorage('key', [])` is acceptable but `useStorage('key', { foo: 'bar' })` is not recommended.
 *
 * @returns A tuple of [value, setValue] similar to useState
 *
 * @example
 * // ✅ Good: module-level constant
 * const DEFAULT_SETTINGS = { theme: 'light' };
 * useStorage('local:settings', DEFAULT_SETTINGS);
 *
 * @example
 * // ✅ Acceptable: empty array (no merge logic needed)
 * useStorage('local:items', []);
 *
 * @example
 * // ❌ Avoid: inline object literal
 * useStorage('local:settings', { theme: 'light' }); // Creates new reference each render
 */
export function useStorage<T>(key: StorageKey, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    const load = async () => {
      const stored = await storage.getItem<T>(key);
      if (stored !== null && stored !== undefined) {
        const mergedValue = mergeWithDefault(defaultValue, stored);
        setValue(mergedValue);
      }
    };
    load();

    const unwatch = storage.watch<T>(key, (newValue) => {
      if (newValue !== null && newValue !== undefined) {
        const mergedValue = mergeWithDefault(defaultValue, newValue);
        setValue(mergedValue);
      }
    });

    return unwatch;
  }, [key, defaultValue]);

  const updateValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      const valueToStore =
        typeof newValue === "function" ? (newValue as (prev: T) => T)(value) : newValue;
      setValue(valueToStore);
      storage.setItem(key, valueToStore);
    },
    [key, value]
  );

  return [value, updateValue] as const;
}
