import { useState, useEffect, useCallback } from "react";
import { storage } from "wxt/utils/storage";

// Define the valid storage key types
type StorageKey = `local:${string}` | `session:${string}` | `sync:${string}` | `managed:${string}`;

export function useStorage<T>(key: StorageKey, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    const load = async () => {
      const stored = await storage.getItem<T>(key);
      if (stored !== null && stored !== undefined) {
        setValue(stored);
      }
    };
    load();

    const unwatch = storage.watch<T>(key, (newValue) => {
      if (newValue !== null && newValue !== undefined) {
        setValue(newValue);
      }
    });

    return unwatch;
  }, [key]);

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
