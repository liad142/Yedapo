# Obsidian Integration Upgrade Ideas

> Backlog of ideas to make Obsidian integration more valuable beyond basic `obsidian://new` export.

**Current state (2026-04-10):** Pro users click "Open in Obsidian" in ShareMenu → URI scheme opens Obsidian → creates a new note with the markdown summary. Working end-to-end. Hebrew rendering correct. No `+` encoding bug.

**Why we're doing this:** Obsidian is very different from Notion — it's local-first, file-based, link-driven. Power users live in it daily and care about frontmatter, wikilinks, and graph structure. Basic markdown export is fine but doesn't leverage what makes Obsidian unique.

**How to apply:** When user says "let's work on Obsidian upgrades", revisit this list and start with #1 + #2 together.

---

## Ideas ranked by impact

### #1 — YAML frontmatter with queryable properties ⭐
Add frontmatter at the top of every exported note so Dataview plugin can query them:

```yaml
---
podcast: "How I Built This"
episode: "Patagonia: Yvon Chouinard"
date: 2026-04-09
duration: 45m
tags: [podcast, business, sustainability]
url: https://yedapo.com/episode/...
rating: 
status: unread
---
```

This unlocks Dataview dashboards like "Show all unrated business podcasts" or "This week's listens". The #1 thing Obsidian power users want.

### #2 — Wikilinks instead of plain text ⭐⭐
Instead of plain podcast names, use `[[How I Built This]]`. Same for guests, concepts, topics. Yedapo becomes the glue that builds the user's podcast knowledge graph — each guest and concept becomes a link. After 10 episodes exported, the graph view lights up with connections.

**#1 + #2 combined = transforms Yedapo from "one-shot export" into "entry point of user's entire podcast knowledge graph".**

### #3 — Custom folder structure
Let users pick: `Podcasts/{podcast-name}/{episode-name}.md` vs flat. Matches how Obsidian users organize vaults.

### #4 — Auto-sync via watched folder
Obsidian URI scheme has a browser prompt that makes auto-sync annoying. Solutions:
- **Watched folder pattern**: Yedapo drops `.md` files into a Dropbox/iCloud folder. Obsidian syncs from that folder. Zero clicks.
- Daily email with a single link that opens all new summaries in Obsidian at once.

### #5 — Daily/Weekly digest notes
Every Monday, Yedapo generates `2026-W15 Weekly Listen.md` with all episode summaries from the past week grouped as H2 sections with wikilinks. Drops into user's "Daily Notes" folder.

### #6 — Canvas-style visual export
Obsidian Canvas is an infinite whiteboard. Yedapo could export a podcast series as a Canvas file showing episode cards connected by theme/guest relationships.

### #7 — Highlight-only export
User picks specific highlights → exports as individual notes with backlinks to parent episode note. Builds a "Quotes" folder.

### #8 — Template support
User puts a template in their vault (`Templates/Podcast Summary.md` with `{{title}}`, `{{brief}}`, etc.) → Yedapo fills it in. Power users customize everything this way.

---

## Recommended build order

1. **#1 + #2 together** (frontmatter + wikilinks) — quick wins, huge perceived value
2. **#4 watched folder pattern** — solves auto-sync without the URI prompt friction
3. **#8 template support** — differentiator for power users
4. Everything else as optional polish

## See also
- [Notion upgrade ideas](./notion-upgrade-ideas.md) — parallel backlog for Notion
