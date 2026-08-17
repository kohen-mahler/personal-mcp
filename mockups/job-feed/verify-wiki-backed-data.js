import "./job-feed-data.js";
import { buildJobFeedData } from "./job-feed-wiki-source.js";

const current = globalThis.JOB_FEED_DATA;
const parsed = await buildJobFeedData({ generatedAt: current.generatedAt, wikiLinkRoot: current.wikiRoot });
const errors = [];

compare(current.opportunities.length, parsed.opportunities.length, "opportunity count");
compare(current.stages, parsed.stages, "stages");
compare(
  current.followUpRules.map((rule) => rule.id),
  parsed.followUpRules.map((rule) => rule.id),
  "follow-up rule ids",
);

parsed.opportunities.forEach((parsedJob) => {
  const currentJob = current.opportunities.find((job) => job.id === parsedJob.id);
  if (!currentJob) {
    errors.push(`missing opportunity ${parsedJob.id}`);
    return;
  }

  [
    "company",
    "role",
    "jobId",
    "stage",
    "status",
    "priority",
    "source",
    "location",
    "term",
    "compensation",
    "appliedAt",
    "lastTouchAt",
    "deadline",
    "nextAction",
    "nextActionDue",
    "followUpRule",
  ].forEach((field) => compare(currentJob[field], parsedJob[field], `${parsedJob.id}.${field}`));

  ["tracker", "monitor", "sourcePage", "companyPage", "contactIndex", "evidence", "coverLetter"].forEach((field) => {
    compare(currentJob.wiki[field] ?? null, parsedJob.wiki[field] ?? null, `${parsedJob.id}.wiki.${field}`);
  });

  compare(
    currentJob.descriptionSignals.map((signal) => [signal.signal, signal.topics, signal.why]),
    parsedJob.descriptionSignals.map((signal) => [signal.signal, signal.topics, signal.why]),
    `${parsedJob.id}.descriptionSignals`,
  );
});

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Verified ${current.opportunities.length} UI opportunities against wiki source files.`);

function compare(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(`${label} mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
