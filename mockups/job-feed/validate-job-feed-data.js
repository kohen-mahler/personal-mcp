import "./job-feed-data.js";

const data = globalThis.JOB_FEED_DATA;
const errors = [];

function requireString(object, field, context) {
  if (typeof object[field] !== "string" || object[field].trim() === "") {
    errors.push(`${context}.${field} must be a non-empty string`);
  }
}

function requireArray(object, field, context) {
  if (!Array.isArray(object[field])) {
    errors.push(`${context}.${field} must be an array`);
  }
}

function isValidDate(value) {
  return typeof value === "string" && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function validateDate(value, context, required = true) {
  if (!value && !required) return;
  if (!isValidDate(value)) errors.push(`${context} must be a YYYY-MM-DD date`);
}

function validateWikiLinks(wiki, context) {
  ["tracker", "monitor", "sourcePage", "companyPage", "contactIndex", "evidence"].forEach((field) => {
    requireString(wiki, field, `${context}.wiki`);
  });
}

if (!data || typeof data !== "object") {
  errors.push("JOB_FEED_DATA must be available on globalThis");
} else {
  validateDate(data.generatedAt, "generatedAt");
  requireString(data, "wikiRoot", "JOB_FEED_DATA");
  requireArray(data, "stages", "JOB_FEED_DATA");
  requireArray(data, "followUpRules", "JOB_FEED_DATA");
  requireArray(data, "opportunities", "JOB_FEED_DATA");

  const stageSet = new Set(data.stages ?? []);
  const ruleSet = new Set((data.followUpRules ?? []).map((rule) => rule.id));

  data.followUpRules?.forEach((rule, index) => {
    const context = `followUpRules[${index}]`;
    requireString(rule, "id", context);
    requireString(rule, "label", context);
    requireString(rule, "trigger", context);
    requireString(rule, "action", context);
  });

  data.opportunities?.forEach((job, index) => {
    const context = `opportunities[${index}]`;
    [
      "id",
      "company",
      "role",
      "jobId",
      "stage",
      "status",
      "priority",
      "source",
      "location",
      "term",
      "nextAction",
      "followUpRule",
    ].forEach((field) => requireString(job, field, context));

    validateDate(job.appliedAt, `${context}.appliedAt`);
    validateDate(job.lastTouchAt, `${context}.lastTouchAt`);
    validateDate(job.firstResponseAt, `${context}.firstResponseAt`, false);
    validateDate(job.deadline, `${context}.deadline`);
    validateDate(job.nextActionDue, `${context}.nextActionDue`, false);

    if (!stageSet.has(job.stage)) errors.push(`${context}.stage must exist in stages`);
    if (!ruleSet.has(job.followUpRule)) errors.push(`${context}.followUpRule must exist in followUpRules`);
    if (job.nextActionDue && job.appliedAt && new Date(`${job.nextActionDue}T00:00:00Z`) < new Date(`${job.appliedAt}T00:00:00Z`)) {
      errors.push(`${context}.nextActionDue cannot be before appliedAt`);
    }

    validateWikiLinks(job.wiki ?? {}, context);
    requireArray(job, "contacts", context);
    requireArray(job, "descriptionSignals", context);
    requireArray(job, "evidenceMatches", context);
    requireArray(job, "timeline", context);
    requireArray(job, "decisionNotes", context);

    job.descriptionSignals?.forEach((signal, signalIndex) => {
      const signalContext = `${context}.descriptionSignals[${signalIndex}]`;
      requireString(signal, "signal", signalContext);
      requireString(signal, "why", signalContext);
      requireArray(signal, "topics", signalContext);
      if (!signal.topics?.length) errors.push(`${signalContext}.topics must not be empty`);
    });

    job.timeline?.forEach((event, eventIndex) => {
      const eventContext = `${context}.timeline[${eventIndex}]`;
      validateDate(event.date, `${eventContext}.date`);
      requireString(event, "label", eventContext);
      requireString(event, "detail", eventContext);
    });
  });

  requireArray(data.reinforcement ?? {}, "loops", "reinforcement");
  requireArray(data.reinforcement ?? {}, "writebackLog", "reinforcement");
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Validated ${data.opportunities.length} opportunities, ${data.stages.length} stages, and ${data.followUpRules.length} follow-up rules.`);
