"use client";
// Registers the hand-written service worker (FR-16, NFR-12): the app shell opens offline. It never caches /api, /c or /v.
import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline shell is an enhancement; the app works without it.
      });
    }
  }, []);
  return null;
}
