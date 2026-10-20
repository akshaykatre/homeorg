"use client";

import { useEffect, useState } from "react";

/** Current time in ms, refreshed on an interval so relative-time UI stays live. */
export function useNow(intervalMs = 20000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
