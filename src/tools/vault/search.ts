export type SearchResult = {
  path: string;
  score: number;
  excerpt: string;
  foundWords: string[];
};

export type SearchOutcome =
  | { ok: true; results: SearchResult[] }
  | { ok: false; error: string };

export async function searchVault(
  port: number,
  query: string,
  limit = 10
): Promise<SearchOutcome> {
  const url = `http://localhost:${port}/search?q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      return { ok: false, error: `Omnisearch returned HTTP ${res.status}` };
    }
    const raw = (await res.json()) as Array<{
      score: number;
      path: string;
      foundWords: string[];
      excerpt: string;
    }>;
    const results: SearchResult[] = raw.slice(0, limit).map((r) => ({
      path: r.path,
      score: r.score,
      excerpt: r.excerpt,
      foundWords: r.foundWords,
    }));
    return { ok: true, results };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    const portHint = `port ${port}`;
    return {
      ok: false,
      error: isTimeout
        ? `Omnisearch timed out on ${portHint} — is Obsidian open with the HTTP server enabled?`
        : `Omnisearch unavailable on ${portHint} — is Obsidian open with the HTTP server enabled?`,
    };
  } finally {
    clearTimeout(timeout);
  }
}
