import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildJobFeedData } from "./job-feed-wiki-source.js";

const args = new Set(process.argv.slice(2));
const directory = path.dirname(fileURLToPath(import.meta.url));
const data = await buildJobFeedData();
const output = `const JOB_FEED_DATA = ${JSON.stringify(data, null, 2)};\n\nglobalThis.JOB_FEED_DATA = JOB_FEED_DATA;\n`;

if (args.has("--write")) {
  await writeFile(path.join(directory, "job-feed-data.js"), output);
  console.log(`Wrote ${data.opportunities.length} wiki-backed opportunities to job-feed-data.js`);
} else {
  process.stdout.write(output);
}
