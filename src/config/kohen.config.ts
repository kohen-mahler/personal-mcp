import type { UserConfig } from "./schema.ts";

export default {
  port: Number(process.env.PORT) || 3000,
  vaults: [
    {
      name: "vault",
      rootPath: process.env.VAULT_PATH ?? "/Users/kohenmahler/vault",
      omnisearchPort: Number(process.env.VAULT_OMNISEARCH_PORT) || 51361,
      description:
        "kohen's personal Obsidian vault. Use for daily notes, Jotpad (active todos and priorities), journal entries, project notes, and anything tied to kohen's current work or life. Prefer this vault for capturing new information or checking on active context.",
    },
    {
      name: "wiki",
      rootPath: process.env.WIKI_PATH ?? "/Users/kohenmahler/wiki",
      omnisearchPort: Number(process.env.WIKI_OMNISEARCH_PORT) || 51362,
      description:
        "kohen's personal wiki — a second Obsidian vault for reference material, permanent notes, and structured knowledge. Use for looking up stable reference content, not day-to-day active notes.",
    },
  ],
  github: {
    token: process.env.GITHUB_TOKEN ?? "",
    owner: "kohenmahler",
    repo: "obsidian-vault",
    branch: "main",
  },
  // postgres: {
  //   url: process.env.PG_URL ?? "",
  // },
} satisfies UserConfig;
