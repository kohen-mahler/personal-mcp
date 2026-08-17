import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_STAGES = [
  "Sourced",
  "Preparing",
  "Applied",
  "Assessment",
  "Recruiter Screen",
  "Interviewing",
  "Offer",
  "Closed",
];

const FOLLOW_UP_RULES = [
  {
    id: "applied-stale",
    label: "Applied stale",
    trigger: "Applied at least 7 calendar days ago, no employer response, no assessment pending",
    action: "Check portal, then follow up if there is a known contact",
  },
  {
    id: "assessment-pending",
    label: "Assessment pending",
    trigger: "Assessment exists and deadline is within 48 hours",
    action: "Prioritize completion",
  },
  {
    id: "recruiter-silence",
    label: "Recruiter silence",
    trigger: "Recruiter last touched at least 2 business days ago with no next step",
    action: "Send a short check-in",
  },
  {
    id: "interview-thank-you",
    label: "Interview thank-you",
    trigger: "Interview completed yesterday and no thank-you logged",
    action: "Send thank-you note",
  },
  {
    id: "missing-contact",
    label: "Missing contact",
    trigger: "High-priority opportunity has no linked contact",
    action: "Search wiki and attach or create contact note",
  },
  {
    id: "missing-evidence",
    label: "Missing evidence",
    trigger: "Job has no mapped evidence or resume version",
    action: "Attach evidence before next interaction",
  },
];

const REINFORCEMENT = {
  principle: "Every user action should leave structured state behind so the next dashboard render is smarter.",
  writebackLog: [],
  loops: [
    {
      event: "Stage updated",
      writeback: "Update tracker row and append a timeline event",
      reinforcement: "Recompute funnel counts, conversion, days in stage, and next action",
    },
    {
      event: "Follow-up sent",
      writeback: "Set lastTouchAt, append message/contact link, clear or move nextActionDue",
      reinforcement: "Suppress duplicate reminders and start recruiter-silence timer if a contact exists",
    },
    {
      event: "Contact attached",
      writeback: "Link contact note to company, opportunity, and monitor",
      reinforcement: "Upgrade future suggestions from portal checks to relationship-aware follow-ups",
    },
    {
      event: "Job description archived",
      writeback: "Create source note and map description signals to learning topics",
      reinforcement: "Improve prep prompts and evidence matching without copying descriptions into the tracker",
    },
    {
      event: "Outcome logged",
      writeback: "Record offer/rejection/withdrawal and capture lesson",
      reinforcement: "Improve rates, source quality, and future evidence selection",
    },
  ],
};

const KNOWN_EVIDENCE = {
  "entities/kraft-heinz": [
    "Vision Fillers dashboard and workflow work",
    "Event logistics and partner coordination through AFP",
    "Verified Canadian work authorization",
  ],
  "entities/kpmg-canada": [
    "Vision Fillers client-system translation story",
    "PAI/Pulse automation and judgment framing",
    "Verified communication and client-work evidence",
  ],
};

const KNOWN_DECISIONS = {
  "entities/kraft-heinz": [
    "Function is determined by business need and candidate preference.",
    "Housing is provided for the internship duration.",
    "Assessment status is still unknown.",
  ],
  "entities/kpmg-canada": [
    "Selected office and term are still unknown.",
    "Cover letter, resume, and unofficial transcript were required.",
    "Responsible AI and human judgment are strong interview angles.",
  ],
};

export async function buildJobFeedData(options = {}) {
  const wikiRoot = options.wikiRoot ?? process.env.WIKI_PATH ?? path.join(process.env.HOME ?? "", "wiki");
  const generatedAt = options.generatedAt ?? "2026-08-17";
  const tracker = await readWikiPage(wikiRoot, "career/internship-tracker");
  const monitor = await readWikiPage(wikiRoot, "career/job-feed-visual-tracker");
  const applications = parseApplications(tracker);
  const details = parseApplicationDetails(tracker);
  const learningByCompany = parseLearningTopics(monitor);

  const opportunities = await Promise.all(
    applications.map(async (application) => {
      const detail = details.get(application.companyPage) ?? {};
      const sourcePage = detail.archivedDescription ?? sourcePageForCompany(application.companyPage);
      const sourceText = await readWikiPage(wikiRoot, sourcePage);
      const companyTitle = await readCompanyTitle(wikiRoot, application.companyPage);
      const companyKey = companyTitle.toLowerCase().includes("kpmg") ? "KPMG Canada" : "Kraft Heinz";
      const appliedAt = parseHumanDate(application.applied);
      const deadline = parseHumanDate(detail.applicationDeadline);
      const nextActionDue = addDays(appliedAt, 7);

      return {
        id: slugify(`${companyTitle}-${application.position}`),
        company: companyTitle,
        role: application.position,
        jobId: application.jobId,
        stage: normalizeStage(application.status),
        status: statusFor(application.companyPage, application.status),
        priority: application.companyPage.includes("kpmg") ? "High" : "Medium",
        source: sourceLabel(sourceText),
        location: application.location,
        term: application.term,
        compensation: detail.pay ?? detail.payRange ?? "Not recorded",
        appliedAt,
        lastTouchAt: appliedAt,
        firstResponseAt: null,
        deadline,
        nextAction: actionFor(application.companyPage, application.nextStep),
        nextActionDue,
        followUpRule: "applied-stale",
        contacts: [],
        wiki: {
          tracker: "career/internship-tracker",
          monitor: "career/job-feed-visual-tracker",
          sourcePage,
          companyPage: application.companyPage,
          contactIndex: "entities/networking/INDEX",
          evidence: "career/application-evidence",
          ...(application.companyPage.includes("kpmg") ? { coverLetter: "skills/cover-letter" } : {}),
        },
        descriptionSignals: learningByCompany.get(companyKey) ?? [],
        evidenceMatches: KNOWN_EVIDENCE[application.companyPage] ?? [],
        timeline: [
          { date: appliedAt, label: "Applied", detail: "Submitted application" },
          { date: nextActionDue, label: "Follow-up threshold", detail: "Seven-day review point" },
        ],
        decisionNotes: KNOWN_DECISIONS[application.companyPage] ?? [],
      };
    }),
  );

  return {
    generatedAt,
    wikiRoot: options.wikiLinkRoot ?? "../../../wiki",
    stages: DEFAULT_STAGES,
    followUpRules: FOLLOW_UP_RULES,
    opportunities,
    reinforcement: REINFORCEMENT,
  };
}

async function readWikiPage(wikiRoot, page) {
  return readFile(path.join(wikiRoot, `${page}.md`), "utf8");
}

function parseApplications(markdown) {
  const section = sectionBetween(markdown, "## Applications", "## Application Details");
  return section
    .split("\n")
    .filter((line) => line.startsWith("|") && !line.includes("---") && !line.includes("Company |"))
    .map((line) => splitTableRow(line))
    .filter((cells) => cells.length >= 8)
    .map(([companyCell, position, jobId, location, term, status, applied, nextStep]) => ({
      companyPage: extractWikiLink(companyCell),
      position,
      jobId,
      location,
      term,
      status,
      applied,
      nextStep,
    }));
}

function parseApplicationDetails(markdown) {
  const details = new Map();
  const headings = [...markdown.matchAll(/^### \[\[([^\]]+)\]\].*$/gm)];
  headings.forEach((heading, index) => {
    const companyPage = heading[1];
    const start = heading.index ?? 0;
    const end = headings[index + 1]?.index ?? markdown.length;
    const block = markdown.slice(start, end);
    details.set(companyPage, {
      archivedDescription: extractBulletLink(block, "Archived description"),
      applicationDeadline: extractBulletText(block, "Application deadline"),
      pay: extractBulletText(block, "Pay"),
      payRange: extractBulletText(block, "Pay range"),
    });
  });
  return details;
}

function parseLearningTopics(markdown) {
  const learning = new Map();
  [
    ["Kraft Heinz", "### KPMG Canada"],
    ["KPMG Canada", "## Context Graph Tab"],
  ].forEach(([company, endHeading]) => {
    const section = sectionBetween(markdown, `### ${company}`, endHeading);
    const rows = section
      .split("\n")
      .filter((line) => line.startsWith("|") && !line.includes("---") && !line.includes("Description signal"))
      .map(splitTableRow)
      .filter((cells) => cells.length >= 3)
      .map(([signal, topicsCell, why]) => ({
        signal,
        topics: [...topicsCell.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => match[1]),
        why,
      }));
    learning.set(company, rows);
  });
  return learning;
}

async function readCompanyTitle(wikiRoot, companyPage) {
  const text = await readWikiPage(wikiRoot, companyPage);
  const title = text.match(/^title:\s*(.+)$/m)?.[1]?.trim();
  return title ?? companyPage.split("/").pop() ?? companyPage;
}

function sectionBetween(markdown, startHeading, endHeading) {
  const start = markdown.indexOf(startHeading);
  if (start === -1) return "";
  const afterStart = start + startHeading.length;
  const end = markdown.indexOf(endHeading, afterStart);
  return markdown.slice(afterStart, end === -1 ? markdown.length : end);
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function extractWikiLink(text) {
  const match = text.match(/\[\[([^\]]+)\]\]/);
  if (!match) throw new Error(`Missing wikilink in: ${text}`);
  return match[1];
}

function extractBulletLink(block, label) {
  const value = extractBulletText(block, label);
  return value ? extractWikiLink(value) : undefined;
}

function extractBulletText(block, label) {
  return block.match(new RegExp(`^- \\*\\*${escapeRegExp(label)}:\\*\\*\\s*(.+)$`, "m"))?.[1]?.trim();
}

function parseHumanDate(value) {
  if (!value || value === "Unknown") return null;
  const cleaned = value.replace(/\bat\b.*$/i, "").trim();
  const timestamp = Date.parse(`${cleaned} UTC`);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10);
}

function addDays(date, days) {
  if (!date) return null;
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function normalizeStage(status) {
  return DEFAULT_STAGES.includes(status) ? status : "Applied";
}

function sourceLabel(sourceText) {
  if (sourceText.includes("KPMG Canada posting") || sourceText.includes("KPMG Canada Careers")) return "KPMG Careers";
  if (sourceText.includes("Kraft Heinz Workday")) return "Workday";
  return "Archived posting";
}

function statusFor(companyPage, status) {
  if (companyPage.includes("kraft-heinz")) return "Waiting for assessment or portal update";
  if (companyPage.includes("kpmg")) return "Waiting for portal update";
  return status;
}

function actionFor(companyPage, fallback) {
  if (companyPage.includes("kraft-heinz")) return "Check assessment status or candidate portal before sending any follow-up";
  if (companyPage.includes("kpmg")) return "Check portal status and confirm selected office/term if available";
  return fallback;
}

function sourcePageForCompany(companyPage) {
  if (companyPage.includes("kraft-heinz")) return "sources/kraft-heinz-2027-canada-internship-r-105290";
  if (companyPage.includes("kpmg")) return "sources/kpmg-technology-risk-services-intern-coop-33316";
  throw new Error(`No source page mapping for ${companyPage}`);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
