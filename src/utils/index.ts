export * from "./domain";
export * from "./cookie-risk";
export * from "./format";
export * from "./theme";

export {
  clearSingleCookie,
  createCookie,
  editCookie,
  clearCookies,
  getAllCookies,
  type CookieRemoveResult,
} from "./cleanup/cookie-ops";
export { buildOrigins, buildNonEmptyOrigins, clearBrowserData } from "./cleanup/site-data-ops";

export const toggleSetValue = (set: Set<string>, value: string): Set<string> => {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
};

export const filterSetByValidKeys = <T>(prevSet: Set<T>, validKeys: Set<T>): Set<T> => {
  const next = new Set<T>();
  prevSet.forEach((key) => {
    if (validKeys.has(key)) next.add(key);
  });
  return next;
};
