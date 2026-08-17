const TODAY = new Date(`${JOB_FEED_DATA.generatedAt}T00:00:00Z`);
let selectedJobId = JOB_FEED_DATA.opportunities[0]?.id;
let themePreference = localStorage.getItem("job-feed-theme") ?? "auto";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function parseDate(value) {
  return value ? new Date(`${value}T00:00:00Z`) : null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function daysBetween(start, end = TODAY) {
  const date = parseDate(start);
  if (!date) return null;
  return Math.round((end.getTime() - date.getTime()) / 86400000);
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "Not recorded";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function wikiHref(path) {
  return `${JOB_FEED_DATA.wikiRoot}/${encodeURI(path)}.md`;
}

function wikiChip(path, tone = "") {
  const label = path.split("/").pop();
  return `<a class="chip ${escapeHtml(tone)}" href="${escapeHtml(wikiHref(path))}">${escapeHtml(label)}</a>`;
}

function getDueState(job) {
  const due = parseDate(job.nextActionDue);
  if (!due) return "unscheduled";
  const days = Math.round((due.getTime() - TODAY.getTime()) / 86400000);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "soon";
  return "later";
}

function isDueNow(job) {
  const state = getDueState(job);
  return state === "overdue" || state === "today";
}

function isDueSoon(job) {
  const state = getDueState(job);
  return state === "overdue" || state === "today" || state === "soon";
}

function getMetrics() {
  const jobs = JOB_FEED_DATA.opportunities;
  const applied = jobs.filter((job) => job.appliedAt).length;
  const heardBack = jobs.filter((job) => job.firstResponseAt).length;
  const interviews = jobs.filter((job) => job.stage === "Interviewing").length;
  const offers = jobs.filter((job) => job.stage === "Offer").length;
  const closed = jobs.filter((job) => job.stage === "Closed").length;
  const active = jobs.length - closed;
  const overdue = jobs.filter((job) => getDueState(job) === "overdue").length;
  const dueToday = jobs.filter((job) => getDueState(job) === "today").length;
  const dueSoon = jobs.filter(isDueSoon).length;

  return [
    ["Active", active, "open opportunities"],
    ["Applied", applied, "submitted applications"],
    ["Heard Back", heardBack, `${applied ? Math.round((heardBack / applied) * 100) : 0}% response rate`],
    ["Interviews", interviews, `${applied ? Math.round((interviews / applied) * 100) : 0}% interview rate`],
    ["Offers", offers, `${applied ? Math.round((offers / applied) * 100) : 0}% offer rate`],
    ["Due Today", dueToday, `${overdue} overdue`],
    ["Due Soon", dueSoon, "overdue, today, and next 7 days"],
  ];
}

function renderMetrics() {
  $("#metrics").innerHTML = getMetrics()
    .map(
      ([label, value, helper]) => `
        <article class="metric">
          <strong>${value}</strong>
          <span>${label}</span>
          <p class="meta">${helper}</p>
        </article>
      `,
    )
    .join("");
}

function actionScore(job) {
  const due = parseDate(job.nextActionDue);
  const dueDays = due ? Math.round((due.getTime() - TODAY.getTime()) / 86400000) : 999;
  const priorityScore = job.priority === "High" ? 0 : 1;
  return priorityScore * 100 + dueDays;
}

function renderActions() {
  const dueNow = [...JOB_FEED_DATA.opportunities].filter(isDueNow).sort((a, b) => actionScore(a) - actionScore(b));
  const upcoming = [...JOB_FEED_DATA.opportunities]
    .filter((job) => getDueState(job) === "soon")
    .sort((a, b) => actionScore(a) - actionScore(b));
  $("#action-count").textContent = `${dueNow.length} due today`;
  $("#action-list").innerHTML = `
    <div class="queue-section">
      ${dueNow.length ? dueNow.map(renderActionCard).join("") : `<div class="empty-state">No actions are due today. The next scheduled follow-ups are shown below.</div>`}
    </div>
    <div class="queue-section">
      <h3>Next Up</h3>
      ${upcoming.map(renderActionCard).join("")}
    </div>
  `;
}

function renderActionCard(job) {
  const rule = JOB_FEED_DATA.followUpRules.find((item) => item.id === job.followUpRule);
  const age = daysBetween(job.appliedAt);
  const dueState = getDueState(job);
  const ruleText = dueState === "soon"
    ? `Scheduled ${rule?.label ?? "Manual review"}`
    : `${rule?.label ?? "Manual review"}`;
  return `
    <article class="action-card">
      <span class="priority ${escapeHtml(job.priority.toLowerCase())}">${escapeHtml(job.priority)}</span>
      <div>
        <h3>${escapeHtml(job.company)}</h3>
        <p>${escapeHtml(job.role)}</p>
        <p class="meta">${escapeHtml(job.stage)} for ${escapeHtml(age)} days. ${escapeHtml(ruleText)}: ${escapeHtml(job.nextAction)}</p>
        <div class="chips">
          ${wikiChip(job.wiki.sourcePage, "blue")}
          ${wikiChip(job.wiki.companyPage, "green")}
          ${wikiChip(job.wiki.contactIndex)}
        </div>
      </div>
      <strong class="due">${escapeHtml(formatDate(job.nextActionDue))}</strong>
    </article>
  `;
}

function renderLoops() {
  $("#loop-list").innerHTML = JOB_FEED_DATA.reinforcement.loops
    .map(
      (loop) => `
        <article class="loop-card">
          <h3>${escapeHtml(loop.event)}</h3>
          <p>${escapeHtml(loop.writeback)}</p>
          <strong>${escapeHtml(loop.reinforcement)}</strong>
        </article>
      `,
    )
    .join("") + renderWritebackLog();
}

function renderWritebackLog() {
  const entries = JOB_FEED_DATA.reinforcement.writebackLog;
  if (!entries.length) return `<div class="empty-state">No simulated writebacks yet.</div>`;
  return entries
    .map(
      (entry) => `
        <article class="loop-card">
          <h3>${escapeHtml(entry.event)}</h3>
          <p>${escapeHtml(entry.effect)}</p>
          <strong>${escapeHtml(entry.at)}</strong>
        </article>
      `,
    )
    .join("");
}

function renderFunnel() {
  const max = Math.max(...JOB_FEED_DATA.stages.map((stage) => countStage(stage)), 1);
  $("#funnel").innerHTML = JOB_FEED_DATA.stages
    .map((stage) => {
      const count = countStage(stage);
      const jobs = JOB_FEED_DATA.opportunities.filter((job) => job.stage === stage);
      const oldest = jobs.length ? Math.max(...jobs.map((job) => daysBetween(job.appliedAt) ?? 0)) : 0;
      const width = Math.max(8, Math.round((count / max) * 100));
      return `
        <article class="funnel-stage">
          <header>
            <strong>${escapeHtml(count)}</strong>
            <span>${escapeHtml(stage)}</span>
          </header>
          <div class="stage-fill" style="width:${width}%"></div>
          <div class="stage-body">
            <p>${escapeHtml(jobs.length ? `${oldest} days oldest item` : "No records")}</p>
            <p>${escapeHtml(jobs.filter(isDueNow).length)} due now</p>
          </div>
        </article>
      `;
    })
    .join("");
}

function countStage(stage) {
  return JOB_FEED_DATA.opportunities.filter((job) => job.stage === stage).length;
}

function renderStageTable() {
  $("#stage-table").innerHTML = JOB_FEED_DATA.opportunities
    .map(
      (job) => `
        <div class="stage-row">
          <strong>${escapeHtml(job.company)} · ${escapeHtml(job.role)}</strong>
          <span>${escapeHtml(job.stage)}</span>
          <span>${escapeHtml(daysBetween(job.appliedAt))} days</span>
          <span>${escapeHtml(formatDate(job.nextActionDue))}</span>
          <button class="tab-link" type="button" data-job="${escapeHtml(job.id)}">Open detail</button>
        </div>
      `,
    )
    .join("");
}

function renderJobPicker() {
  $("#job-picker").innerHTML = JOB_FEED_DATA.opportunities
    .map(
      (job) => `
        <button class="job-option ${job.id === selectedJobId ? "is-active" : ""}" type="button" data-job="${escapeHtml(job.id)}">
          <strong>${escapeHtml(job.company)}</strong>
          <span>${escapeHtml(job.role)}</span>
          <p class="meta">${escapeHtml(job.stage)} · due ${escapeHtml(formatDate(job.nextActionDue))}</p>
        </button>
      `,
    )
    .join("");
}

function renderDetail() {
  const job = JOB_FEED_DATA.opportunities.find((item) => item.id === selectedJobId);
  if (!job) return;
  $("#detail-panel").innerHTML = `
    <div class="panel-header">
      <div>
        <h2>${escapeHtml(job.company)}</h2>
        <p class="meta">${escapeHtml(job.role)}</p>
      </div>
      <span>${escapeHtml(job.status)}</span>
    </div>
    <div class="action-bar">
      <button class="tab-link" type="button" data-action="followup" data-job="${escapeHtml(job.id)}">Log follow-up</button>
      <button class="tab-link" type="button" data-action="contact" data-job="${escapeHtml(job.id)}">Attach contact</button>
      <button class="tab-link" type="button" data-action="advance" data-job="${escapeHtml(job.id)}">Advance stage</button>
      <button class="tab-link" type="button" data-action="archive" data-job="${escapeHtml(job.id)}">Archive outcome</button>
    </div>
    <div class="detail-grid">
      ${fact("Stage", job.stage)}
      ${fact("Applied", formatDate(job.appliedAt))}
      ${fact("Next Action", formatDate(job.nextActionDue))}
      ${fact("Location", job.location)}
      ${fact("Term", job.term)}
      ${fact("Compensation", job.compensation)}
    </div>
    <section class="detail-section">
      <h3>Wiki Context</h3>
      <div class="chips">
        ${Object.values(job.wiki).map((path) => wikiChip(path)).join("")}
      </div>
    </section>
    <section class="detail-section">
      <h3>Description To Learning</h3>
      <div class="signal-table">
        ${job.descriptionSignals
          .map(
            (signal) => `
              <div class="signal-row">
                <strong>${escapeHtml(signal.signal)}</strong>
                <div class="chips">${signal.topics.map((topic) => wikiChip(topic, "blue")).join("")}</div>
                <span>${escapeHtml(signal.why)}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
    <section class="detail-section">
      <h3>Evidence Match</h3>
      <div class="chips">${job.evidenceMatches.map((item) => `<span class="chip green">${escapeHtml(item)}</span>`).join("")}</div>
    </section>
    <section class="detail-section">
      <h3>Timeline</h3>
      <div class="timeline">
        ${job.timeline
          .map(
            (item) => `
              <div class="timeline-item">
                <strong>${formatDate(item.date)}</strong>
                <span>${escapeHtml(item.label)}<br><span class="timeline-detail">${escapeHtml(item.detail)}</span></span>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
    <section class="detail-section">
      <h3>Decision Notes</h3>
      <div class="chips">${job.decisionNotes.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("")}</div>
    </section>
  `;
}

function fact(label, value) {
  return `<div class="fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderGraph() {
  const edges = buildGraphEdges();
  $("#graph").innerHTML = edges
    .map(
      (edge) => `
        <article class="node">
          <div class="edge-row">
            ${wikiChip(edge.from, "green")}
            <strong>to</strong>
            ${wikiChip(edge.to, "blue")}
          </div>
        </article>
      `,
    )
    .join("");
}

function buildGraphEdges() {
  const edges = [["career/job-feed-visual-tracker", "career/internship-tracker"]];
  JOB_FEED_DATA.opportunities.forEach((job) => {
    edges.push(["career/job-feed-visual-tracker", job.wiki.companyPage]);
    edges.push(["career/job-feed-visual-tracker", job.wiki.sourcePage]);
    edges.push(["career/internship-tracker", job.wiki.companyPage]);
    edges.push(["career/internship-tracker", job.wiki.sourcePage]);
    edges.push([job.wiki.sourcePage, job.wiki.companyPage]);
    edges.push([job.wiki.companyPage, job.wiki.contactIndex]);
    edges.push([job.wiki.sourcePage, job.wiki.evidence]);
    job.descriptionSignals.forEach((signal) => {
      signal.topics.forEach((topic) => edges.push([job.wiki.sourcePage, topic]));
    });
  });
  return edges.map(([from, to]) => ({ from, to }));
}

function renderBacklinkRules() {
  const rules = [
    "Monitor links to tracker, active company pages, source notes, networking index, and learning index.",
    "Tracker rows link to company pages, source notes, monitor note, and contact entry point.",
    "Source notes link back to company entities, tracker, and monitor.",
    "Company pages link to active opportunities, archived descriptions, and relevant contacts.",
    "Contact notes link to person, company entity, opportunity, last conversation, and follow-up status.",
    "Learning topic notes link back to job descriptions when a topic becomes interview-relevant.",
  ];
  $("#backlink-rules").innerHTML = rules.map((rule) => `<article class="loop-card">${escapeHtml(rule)}</article>`).join("");
}

function activateTab(tabName) {
  $$(".tab").forEach((tab) => {
    const active = tab.dataset.tab === tabName;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  $$(".view").forEach((view) => {
    const active = view.id === `tab-${tabName}`;
    view.classList.toggle("is-active", active);
    view.toggleAttribute("hidden", !active);
  });
}

function bindEvents() {
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });
  $$("[data-theme-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      themePreference = button.dataset.themeChoice;
      localStorage.setItem("job-feed-theme", themePreference);
      applyTheme();
    });
  });
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-job]");
    if (!target) return;
    const action = target.dataset.action;
    selectedJobId = target.dataset.job;
    if (action) applyMockAction(action, selectedJobId);
    renderJobPicker();
    renderDetail();
    renderMetrics();
    renderActions();
    renderLoops();
    renderFunnel();
    renderStageTable();
    activateTab("detail");
  });
}

function applyTheme() {
  document.documentElement.dataset.theme = themePreference === "auto" ? "" : themePreference;
  $$("[data-theme-choice]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.themeChoice === themePreference);
  });
}

function applyMockAction(action, jobId) {
  const job = JOB_FEED_DATA.opportunities.find((item) => item.id === jobId);
  if (!job) return;
  const stampedAt = formatDate(JOB_FEED_DATA.generatedAt);
  if (action === "followup") {
    job.lastTouchAt = JOB_FEED_DATA.generatedAt;
    job.nextActionDue = "2026-08-24";
    job.timeline.push({ date: JOB_FEED_DATA.generatedAt, label: "Follow-up logged", detail: "Mock writeback updated last touch and moved the next reminder" });
    pushWriteback("Follow-up sent", `${job.company}: lastTouchAt updated and nextActionDue moved to Aug 24, 2026`, stampedAt);
  }
  if (action === "contact") {
    if (!job.contacts.includes("entities/networking/mock-contact")) job.contacts.push("entities/networking/mock-contact");
    job.timeline.push({ date: JOB_FEED_DATA.generatedAt, label: "Contact attached", detail: "Mock contact linked to company, opportunity, and monitor" });
    pushWriteback("Contact attached", `${job.company}: contact backlink added to opportunity context`, stampedAt);
  }
  if (action === "advance") {
    job.stage = job.stage === "Applied" ? "Assessment" : "Recruiter Screen";
    job.status = `Moved to ${job.stage}`;
    job.timeline.push({ date: JOB_FEED_DATA.generatedAt, label: "Stage updated", detail: `Mock stage moved to ${job.stage}` });
    pushWriteback("Stage updated", `${job.company}: funnel counts and detail status recomputed`, stampedAt);
  }
  if (action === "archive") {
    job.stage = "Closed";
    job.status = "Archived for mock outcome review";
    job.nextActionDue = null;
    job.timeline.push({ date: JOB_FEED_DATA.generatedAt, label: "Outcome logged", detail: "Mock outcome archived and removed from active reminders" });
    pushWriteback("Outcome logged", `${job.company}: opportunity closed and rates recomputed`, stampedAt);
  }
}

function pushWriteback(event, effect, at) {
  JOB_FEED_DATA.reinforcement.writebackLog.unshift({ event, effect, at });
  JOB_FEED_DATA.reinforcement.writebackLog = JOB_FEED_DATA.reinforcement.writebackLog.slice(0, 4);
}

function render() {
  $("#freshness").textContent = `Generated ${formatDate(JOB_FEED_DATA.generatedAt)} from wiki-backed records`;
  renderMetrics();
  renderActions();
  renderLoops();
  renderFunnel();
  renderStageTable();
  renderJobPicker();
  renderDetail();
  renderGraph();
  renderBacklinkRules();
  bindEvents();
  applyTheme();
  activateTab("today");
}

render();
