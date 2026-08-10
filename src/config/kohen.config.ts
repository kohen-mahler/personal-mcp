import type { UserConfig, ProxiedServerConfig } from "./schema.ts";

const proxied: ProxiedServerConfig[] = [
  {
    name: "apple-notes",
    command: "bunx",
    args: ["apple-notes-mcp"],
  },
  {
    name: "calendar",
    command: "bunx",
    args: ["calendar-mcp"],
    env: {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
      GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN ?? "",
    },
  },
  {
    name: "netnewswire",
    command: "node",
    args: [`${process.env.HOME}/netnewswire-mcp/dist/index.js`],
  },
  {
    // Verify package name before first run — try: bunx gmail-mcp-server
    // Alternatives if it fails: "@gongrzhe/server-gmail-autoauth-mcp", "mcp-gmail"
    name: "gmail",
    command: "bunx",
    args: ["gmail-mcp-server"],
    env: {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
      GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN ?? "",
    },
  },
];

export default {
  port: Number(process.env.PORT) || 3000,
  proxied,
  vaults: [
    {
      name: "vault",
      rootPath: process.env.VAULT_PATH ?? `${process.env.HOME}/vault`,
      omnisearchPort: Number(process.env.VAULT_OMNISEARCH_PORT) || 51361,
      description:
        "kohen's personal Obsidian vault. Use for daily notes, Jotpad (active todos and priorities), journal entries, project notes, and anything tied to kohen's current work or life. Prefer this vault for capturing new information or checking on active context.",
    },
    {
      name: "wiki",
      rootPath: process.env.WIKI_PATH ?? `${process.env.HOME}/wiki`,
      omnisearchPort: Number(process.env.WIKI_OMNISEARCH_PORT) || 51362,
      description:
        "kohen's personal wiki — a second Obsidian vault for reference material, permanent notes, and structured knowledge. Use for looking up stable reference content, not day-to-day active notes.",
    },
  ],
  // postgres: {
  //   url: process.env.PG_URL ?? "",
  // },
} satisfies UserConfig;
