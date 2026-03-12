import { useState, useEffect, useCallback } from "react";
import { storage } from "wxt/utils/storage";

// Define the valid storage key types
type StorageKey = `local:${string}` | `session:${string}` | `sync:${string}` | `managed:${string}`;

// Helper type to check if T is a record object (not array or primitive)
type IsRecord<T> = T extends Record<string, unknown>
  ? T extends unknown[]
    ? false
    : true
  : false;

export function useStorage<T>(key: StorageKey, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    const load = async () => {
      const stored = await storage.getItem<T>(key);
      if (stored !== null && stored !== undefined) {
        // For record objects, merge with default value to ensure new fields have default values
        // For arrays and primitives, use stored value directly
        const mergedValue =
          typeof stored === "object" &&
          !Array.isArray(stored) &&
          typeof defaultValue === "object" &&
          !Array.isArray(defaultValue)
            ? ({ ...defaultValue, ...stored } as T)
            : stored;
        setValue(mergedValue);
      }
    };
    load();

    const unwatch = storage.watch<T>(key, (newValue) => {
      if (newValue !== null && newValue !== undefined) {
        // For record objects, merge with default value to ensure new fields have default values
        // For arrays and primitives, use new value directly
        const mergedValue =
          typeof newValue === "object" &&
          !Array.isArray(newValue) &&
          typeof defaultValue === "object" &&
          !Array.isArray(defaultValue)
            ? ({ ...defaultValue, ...newValue } as T)
            : newValue;
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
