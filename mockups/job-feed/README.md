# Job Feed Visual Tracker Mockup

Static mockup for the proposed job-feed rework. Open `index.html` directly in a browser.

## Scope

This mockup implements four tabs:

- `Today Actions` — metrics, follow-up queue, and reinforcement loop.
- `Funnel` — pipeline counts and stage records.
- `Detail` — enriched per-job view driven from structured opportunity data.
- `Context Graph` — directed wiki relationships and backlink rules.

## Data Flow

`job-feed-data.js` is intentionally shaped like a future MCP/API response. The UI derives metrics, funnel counts, due reminders, detail panels, graph edges, and wiki context chips from that one object.

The mockup also includes non-persistent detail actions: log follow-up, attach contact, advance stage, and archive outcome. These mutate the in-memory data and re-render the UI so the reinforcement loop is visible during review.

Natural upkeep loop:

- Stage updates write to the tracker and append a timeline event.
- Follow-ups update `lastTouchAt`, clear or move `nextActionDue`, and link any message/contact note.
- Contact attachments update the contact note, company page, opportunity, and monitor graph.
- Job-description archives stay in `wiki/sources`; the UI links to them and maps signals to learning topics.
- Outcomes update the tracker, rates, and evidence notes.

## Notes

- The current data is static and generated from the wiki state on August 17, 2026.
- Wiki links are relative from this mockup directory to `../../../wiki`.
- Parsed wiki/API data must be escaped or rendered through DOM APIs before production integration.

## Validation

Run the data-contract check before promoting parsed wiki data into the UI:

```sh
/home/mahlerkohen/.bun/bin/bun mockups/job-feed/validate-job-feed-data.js
```

## Staged PR Proposal

1. `PR 1: Static visual tracker mockup`
   - Add this mockup and the typed data shape.
   - Review tab layout, funnel, detail view, context graph, and reinforcement model.

2. `PR 2: Wiki parser and data endpoint`
   - Parse `wiki/career/internship-tracker.md`, source notes, company notes, and contact notes into the same data shape.
   - Add tests for status, date, follow-up, and link extraction.

3. `PR 3: Writeback actions`
   - Add update-stage, log-follow-up, attach-contact, and archive-outcome operations.
   - Make every action update wiki records and regenerate derived dashboard state.

4. `PR 4: Production UI integration`
   - Move the approved mockup into the real app surface.
   - Replace static data with the parser/endpoint from PR 2.
