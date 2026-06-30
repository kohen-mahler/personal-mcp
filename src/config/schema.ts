export interface PostgresConfig {
  url: string;
}

export interface VaultDefinition {
  /** Tool name prefix — becomes {name}_read, {name}_list */
  name: string;
  /** Absolute path to the vault root on the local filesystem */
  rootPath: string;
  /** Shown to AI clients in tool descriptions — what this vault is for and when to use it */
  description: string;
  /** Port of the Omnisearch HTTP server for this vault. Requires Obsidian open with Omnisearch plugin + HTTP server enabled. */
  omnisearchPort?: number;
}

export interface ProxiedServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface UserConfig {
  port: number;
  vaults: VaultDefinition[];
  postgres?: PostgresConfig;
  proxied?: ProxiedServerConfig[];
}
