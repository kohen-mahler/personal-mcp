#!/usr/bin/env bun
/**
 * Bridges Claude Desktop's stdio MCP transport to the kohen-mcp HTTP server.
 * Claude Desktop launches this as a process; it proxies JSON-RPC over stdin/stdout
 * to http://localhost:3000/mcp.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "../src/server.ts";
import config from "../src/config/kohen.config.ts";
import { initProxyManager } from "../src/tools/proxied/manager.ts";

const vault = config.vaults.find((v) => v.name === "vault")!;
const wiki = config.vaults.find((v) => v.name === "wiki")!;
const proxyManager = await initProxyManager(config.proxied ?? []);

const server = createMcpServer(vault, wiki, proxyManager);
const transport = new StdioServerTransport();
await server.connect(transport);
