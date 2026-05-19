import { useEffect, useRef } from "react";

export function usePolling(callback: () => void, intervalMs: number) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Call immediately on mount and whenever callback identity changes
  useEffect(() => {
    savedCallback.current();
  }, [callback]);

  // Polling interval (does NOT call on mount — the above effect handles that)
  useEffect(() => {
    const id = setInterval(() => savedCallback.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
