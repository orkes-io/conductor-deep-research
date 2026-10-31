import { useEffect, useRef } from "react";

// Calls fn now and then every `ms` milliseconds while `active` is true and the tab is visible.
export function usePoll(fn: () => void, ms: number, active = true) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    saved.current();
    if (!active) return;
    const id = setInterval(() => {
      if (!document.hidden) saved.current();
    }, ms);
    return () => clearInterval(id);
  }, [ms, active]);
}
