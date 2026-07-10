import { readVaultFile } from "../vault/read";

export type MorningContext = {
  date: string;
  dayOfWeek: string;
  dailyNotePath: string;
  jotpad: string | null;
  yesterday: { path: string; content: string } | null;
  goals: string | null;
};

export type MorningContextResult =
  | { ok: true; data: MorningContext }
  | { ok: false; error: string };

function formatDate(d: Date): string {
  // en-CA locale gives YYYY-MM-DD — LA timezone so date is correct after midnight
  return d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

function getDayOfWeek(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Los_Angeles" });
}

function subtractDay(dateStr: string): string {
  const [y, m, day] = dateStr.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA");
}

export function dailyNotePath(dateStr: string): string {
  return `Notes/Daily/${dateStr}.md`;
}

/**
 * Returns MorningContext with the following fields:
 * - date: YYYY-MM-DD (LA timezone)
 * - dayOfWeek: full weekday name
 * - dailyNotePath: vault-relative path for today's note — write ritual output here via vault_append
 * - jotpad: active priorities from Jotpad.md, null if unreadable
 * - yesterday: { path, content } of yesterday's daily note, null if not found
 * - goals: contents of wiki/ritual/daily-goals.md, null if not yet created
 */
export async function getMorningContext(
  vaultRoot: string,
  wikiRoot: string
): Promise<MorningContextResult> {
  const now = new Date();
  const today = formatDate(now);
  const yesterday = subtractDay(today);

  const todayPath = dailyNotePath(today);
  const yesterdayPath = dailyNotePath(yesterday);

  const [jotpadResult, yesterdayResult, goalsResult] = await Promise.all([
    readVaultFile(vaultRoot, "00 Dashboard/Jotpad.md"),
    readVaultFile(vaultRoot, yesterdayPath),
    readVaultFile(wikiRoot, "ritual/daily-goals.md"),
  ]);

  return {
    ok: true,
    data: {
      date: today,
      dayOfWeek: getDayOfWeek(now),
      dailyNotePath: todayPath,
      jotpad: jotpadResult.ok ? jotpadResult.data.content : null,
      yesterday: yesterdayResult.ok
        ? { path: yesterdayPath, content: yesterdayResult.data.content }
        : null,
      goals: goalsResult.ok ? goalsResult.data.content : null,
    },
  };
}
