import { DEMO_TIME_ZONE, type DemoState } from "./mock-data";

const STORAGE_KEY = "carecircle-demo";

// Bump when the shape of DemoState or the seed changes, so visitors holding an
// older snapshot from a previous deploy get reseeded instead of broken screens.
const SCHEMA_VERSION = 3;

interface StoredDemo {
  version: number;
  seededOn: string;
  state: DemoState;
}

function todayInLagos(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEMO_TIME_ZONE }).format(new Date());
}

/**
 * Returns the saved state, or null if there is none or it is unusable
 * (older schema, or seeded on a previous day so "today's visits" are stale).
 */
export function loadDemoState(): DemoState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredDemo;
    if (stored.version !== SCHEMA_VERSION || stored.seededOn !== todayInLagos()) return null;
    return stored.state;
  } catch {
    return null;
  }
}

export function saveDemoState(state: DemoState): void {
  try {
    const stored: StoredDemo = { version: SCHEMA_VERSION, seededOn: todayInLagos(), state };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Private mode or storage disabled: the demo still works, it just won't survive a refresh.
  }
}
