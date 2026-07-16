import { readVaultFile } from "../vault/read";

// ── Types mirroring Pulse ritual.ts contracts ────────────────────────────────

/** One habit definition + today's completion state. Mirrors Pulse ritual.ts habitsForDay(). */
export type HabitState = {
  id: string;
  label: string;
  icon: string;
  done: boolean;
};

/** One goal entry. Mirrors Pulse ritual.ts Goal interface. */
export type Goal = {
  id: string;
  text: string;
  done: boolean;
  addedAt: string;
  rolledFrom?: string; // date string if carried forward from a prior day
};

/**
 * Full morning context bundle returned by getMorningContext.
 *
 * habits / goals — from Pulse API GET /api/ritual/today (null if Pulse is unreachable)
 * jotpad         — from vault "00 Dashboard/Jotpad.md" (null if unreadable)
 * goalsLibrary   — from wiki "ritual/daily-goals.md" (null if not yet created)
 */
export type MorningContext = {
  date: string;
  dayOfWeek: string;
  habits: HabitState[] | null;
  goals: Goal[] | null;
  jotpad: string | null;
  goalsLibrary: string | null;
};

export type MorningContextResult =
  | { ok: true; data: MorningContext }
  | { ok: false; error: string };

/** Result of adding a goal via the Pulse API. */
export type AddGoalResult =
  | { ok: true; goal: Goal }
  | { ok: false; error: string };

/** Result of toggling a habit via the Pulse API. */
export type ToggleHabitResult =
  | { ok: true; id: string; done: boolean }
  | { ok: false; error: string };

// ── Date helpers ─────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

function getDayOfWeek(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Los_Angeles" });
}

// ── Pulse API helpers ─────────────────────────────────────────────────────────

function pulseUrl(path: string): string {
  const base = (process.env.PULSE_URL ?? "http://localhost:31337").replace(/\/$/, "");
  return `${base}${path}`;
}

async function fetchPulseToday(): Promise<{ habits: HabitState[]; goals: Goal[] } | null> {
  try {
    const res = await fetch(pulseUrl("/api/ritual/today"), {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { habits: HabitState[]; goals: Goal[] };
    return data;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Loads full morning ritual context in parallel:
 *   - Pulse API: today's habit completion state + goals (including yesterday's rollover)
 *   - Vault:     Jotpad.md (active priorities)
 *   - Wiki:      ritual/daily-goals.md (goal options library)
 *
 * Never throws. Missing sources return null fields, not errors.
 */
export async function getMorningContext(
  vaultRoot: string,
  wikiRoot: string
): Promise<MorningContextResult> {
  const now = new Date();

  const [pulseData, jotpadResult, goalsLibResult] = await Promise.all([
    fetchPulseToday(),
    readVaultFile(vaultRoot, "00 Dashboard/Jotpad.md"),
    readVaultFile(wikiRoot, "ritual/daily-goals.md"),
  ]);

  return {
    ok: true,
    data: {
      date: formatDate(now),
      dayOfWeek: getDayOfWeek(now),
      habits: pulseData?.habits ?? null,
      goals: pulseData?.goals ?? null,
      jotpad: jotpadResult.ok ? jotpadResult.data.content : null,
      goalsLibrary: goalsLibResult.ok ? goalsLibResult.data.content : null,
    },
  };
}

/**
 * Adds a goal for today via the Pulse API.
 * Pulse handles UUID generation, timestamps, and file writes.
 * Endpoint: POST /api/ritual/goals/add  body: { text }
 */
export async function addGoal(text: string): Promise<AddGoalResult> {
  try {
    const res = await fetch(pulseUrl("/api/ritual/goals/add"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim() }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
      return { ok: false, error: err.error ?? `HTTP ${res.status}` };
    }
    const goal = await res.json() as Goal;
    return { ok: true, goal };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Pulse unreachable" };
  }
}

/**
 * Dismisses a goal from today's list via the Pulse API.
 * Use for rolled-over goals the user doesn't want to carry forward.
 * Endpoint: POST /api/ritual/goals/dismiss  body: { id }
 */
export async function dismissGoal(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(pulseUrl("/api/ritual/goals/dismiss"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Pulse unreachable" };
  }
}

/**
 * Toggles a habit's done state for today via the Pulse API.
 * Endpoint: POST /api/ritual/habits/:id/toggle
 */
export async function toggleHabit(habitId: string): Promise<ToggleHabitResult> {
  try {
    const res = await fetch(pulseUrl(`/api/ritual/habits/${encodeURIComponent(habitId)}/toggle`), {
      method: "POST",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json() as { id: string; done: boolean };
    return { ok: true, id: data.id, done: data.done };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Pulse unreachable" };
  }
}
