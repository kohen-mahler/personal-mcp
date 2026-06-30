#!/usr/bin/env bun
/**
 * One-time Google OAuth token generator.
 * Run once, paste the refresh token into .env — never run again.
 *
 * Usage:
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... bun scripts/get-google-token.ts
 */

import { createServer } from "node:http";
import { exec } from "node:child_process";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:8888/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before running.");
  process.exit(1);
}

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

exec(`open "${authUrl.toString()}"`);
console.log("Opening browser for Google OAuth consent...");
console.log("URL:", authUrl.toString(), "\n");

const server = createServer(async (req, res) => {
  const url = new URL(req.url!, "http://localhost:8888");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    res.writeHead(400);
    res.end(`OAuth error: ${error ?? "no code received"}`);
    console.error("OAuth failed:", error);
    process.exit(1);
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const tokens = (await tokenRes.json()) as Record<string, string>;

  if (!tokens.refresh_token) {
    res.writeHead(500);
    res.end("No refresh token returned. Ensure prompt=consent was set.");
    console.error("Token response:", tokens);
    process.exit(1);
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<h1>Done! Check your terminal for the refresh token.</h1>");

  console.log("\n✅ Add these to your .env:\n");
  console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
  console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
  console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log("\nDo not run this script again unless you revoke access.");

  server.close();
  process.exit(0);
});

server.listen(8888, () => {
  console.log("Waiting for OAuth redirect on http://localhost:8888/callback...");
});
