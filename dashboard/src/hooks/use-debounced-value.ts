import { useEffect, useState } from "react";

// Returns a copy of `value` that only updates after it has stayed unchanged for
// `delayMs`. Used to avoid firing a request on every keystroke in search boxes.
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
