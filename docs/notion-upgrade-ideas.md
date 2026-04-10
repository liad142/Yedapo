---
name: Notion Integration Upgrade Ideas
description: Backlog of ideas to make Notion integration more valuable beyond basic "Send to Notion" export (on feat/notion-obsidian-integration branch)
type: project
---

The basic Notion integration is live: Pro users click "Send to Notion" in ShareMenu, gets saved to auto-created "Yedapo Summaries" database with Title/Date/Duration/Podcast/URL properties. Working end-to-end as of 2026-04-10.

**Why:** User asked "can we give more value?" — wants to differentiate Yedapo's Notion integration beyond a manual one-click export. These ideas turn it into a real "second brain" feature.

**How to apply:** When user says "let's go back to the Notion upgrade" or similar, revisit this list and build #1 first.

## Upgrade ideas ranked by impact

**#1 — Auto-sync on new episodes (KILLER FEATURE)**
User enables "Auto-sync to Notion" on a podcast subscription. When cron detects new episode + summary is ready, Yedapo auto-creates a Notion page. No click needed. Same pattern as email/telegram notifications but for Notion. Positions Notion as a delivery channel.

**#2 — Richer page properties**
Add to the Notion database: Tags (multi-select), Rating (number), Status (To Listen / Listening / Listened / Archived), Cover image = podcast artwork. Page body structured with toggles: Quick Summary / Deep Summary / Chapters / Highlights / Transcript. Turns Notion into a podcast tracker.

**#3 — Two-way sync**
User marks page as "Listened" in Notion → Yedapo picks it up and marks read. Requires polling/webhooks. Complex but premium.

**#4 — Custom templates**
Power users pick a template: "Research notes", "Book club", "Content ideas", "Learning log". Each template = different property set. Positions Yedapo as research tool.

**#5 — Selective highlight export**
User selects specific highlights/quotes from a summary → sends only those to a "Quotes" database in Notion. Great for knowledge workers.

**#6 — Scheduled Notion digests**
Every Monday morning, Yedapo creates a "Weekly digest" page in Notion grouping all the week's summaries by podcast.

**#7 — AI cross-episode insights**
On export, check what's already in user's Notion database and surface "Related episodes in your database" based on shared tags. Creates compounding value.

**Recommended path:** Start with #1 (auto-sync), then #2 (richer content). Skip #3 until we have webhooks infra.
