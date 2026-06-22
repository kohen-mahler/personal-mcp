export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

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
}

export interface UserConfig {
  port: number;
  vaults: VaultDefinition[];
  github: GitHubConfig;
  postgres?: PostgresConfig;
}
