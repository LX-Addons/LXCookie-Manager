import { useState, useEffect, useCallback, useRef } from "react";
import { storage } from "#imports";

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
 *   **⚠️ 所有引用类型默认值（对象、数组等）必须使用模块级稳定常量，禁止传入内联字面量**，
 *   否则每次渲染都会创建新引用，导致 effect 重复执行、存储重复加载、watcher 反复重绑定。
 *
 * @returns A tuple of [value, setValue] similar to useState
 *
 * @example
 * // ✅ 推荐：使用模块级常量（引用类型）
 * const DEFAULT_SETTINGS = { theme: 'light' };
 * useStorage('local:settings', DEFAULT_SETTINGS);
 *
 * @example
 * // ✅ 推荐：数组也必须使用模块级常量
 * const EMPTY_LIST: ItemType[] = [];
 * useStorage('local:items', EMPTY_LIST);
 */
export function useStorage<T>(key: StorageKey, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const pendingValueRef = useRef<T | null>(null);

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

  useEffect(() => {
    if (pendingValueRef.current !== null) {
      const valueToStore = pendingValueRef.current;
      pendingValueRef.current = null;
      storage.setItem(key, valueToStore).catch((error) => {
        console.error(`Failed to persist storage key "${key}":`, error);
      });
    }
  }, [value, key]);

  const updateValue = useCallback((newValue: T | ((prev: T) => T)) => {
    if (typeof newValue === "function") {
      setValue((prev) => {
        const next = (newValue as (prev: T) => T)(prev);
        pendingValueRef.current = next;
        return next;
      });
    } else {
      setValue(newValue);
      pendingValueRef.current = newValue;
    }
  }, []);

  return [value, updateValue] as const;
}
