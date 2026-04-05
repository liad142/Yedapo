# Yedapo SEO Strategy

> **Last updated:** 2026-04-05
> **Goal:** Rank #1 for episode-specific searches like "lex fridman episode 421 summary", "jensen huang nvidia interview takeaways", etc.
> **Thesis:** Yedapo is a content-SEO product. Summaries ARE the landing pages. Every summary that ranks = one more acquisition channel, compounding daily.

---

## Current SEO Foundation (Already Built)

| Layer | Status | File |
|---|---|---|
| Dynamic sitemap | ✅ Up to 5,000 episodes | `src/app/sitemap.ts` |
| robots.txt | ✅ Blocks /api, /auth, /settings | `src/app/robots.ts` |
| Per-episode metadata | ✅ Title, description, canonical | `src/app/episode/[id]/insights/layout.tsx` |
| Dynamic OG images | ✅ Unique per episode | `src/app/api/og/[id]/route.ts` |
| PodcastEpisode JSON-LD | ✅ With PodcastSeries relationship | `src/app/episode/[id]/insights/layout.tsx` |
| Server-rendered content for crawlers | ✅ `.sr-only` div with summary text | Same file |
| Organization + WebSite JSON-LD | ✅ Added 2026-04-05 | `src/app/layout.tsx` |
| Clean URLs | ⚠️ UUID-based (not keyword-rich) | routes under `/episode/{uuid}/insights` |

This puts Yedapo ahead of ~85% of indie SaaS launches technically.

---

## Two Distinct SEO Problems

### Problem 1: Get ALL summaries indexed by Google (Technical SEO)
### Problem 2: Rank #1 for competitive search queries (Content + Authority)

Different solutions for each.

---

## Problem 1: Indexation

### Manual SEO ops (do once, ~30 min)

1. **Google Search Console**
   - Add property for `www.yedapo.com`
   - Verify via DNS TXT record or HTML file
   - Submit sitemap: `https://www.yedapo.com/sitemap.xml`
   - Request indexing of ~10 top episode URLs manually
2. **Bing Webmaster Tools** — Bing indexes faster than Google for new sites
3. **IndexNow** — auto-pings Bing/Yandex when new summaries publish (Bing free tier supports this)

### Code improvements

- [x] **VideoObject + BreadcrumbList schemas** (PR #41)
- [x] **Split sitemap into 1,000-URL chunks** (PR #41)
- [x] **Add `keywords` meta tag + JSON-LD keywords** (PR #41)
- [x] **Podcast name in `<title>` tag** for branded-search keyword matching (PR #41)
- [ ] **URL slug migration** — **DEFERRED to week 2 post-launch** (see below for why)

### Verification tools

- https://search.google.com/test/rich-results — paste any episode URL, see what Google sees
- https://pagespeed.web.dev — Core Web Vitals affect rankings
- https://search.google.com/search-console — monitor indexed pages

---

## Problem 2: Ranking High

### Lever 1: URL slugs (HIGHEST IMPACT — POST-LAUNCH)

Change:
```
❌ yedapo.com/episode/052bcb7d-9796-454e-9710-899809f76e1f/insights
✅ yedapo.com/podcast/lex-fridman-podcast/421-ai-agents-future
```

Google heavily weights keywords in URL. UUIDs give zero signal. This alone can move rankings 10-20 positions for long-tail queries.

**Why deferred:** 29 internal link touchpoints + DB migration + redirect logic = 1-2 days of focused work. Doing this during pre-launch final testing was too risky.

**Timing:** Ship in Week 2 post-launch, after a few days of validated uptime with real users.

**Implementation plan** (for future-me):
1. Migration: `ALTER TABLE episodes ADD COLUMN short_id TEXT GENERATED ALWAYS AS (substring(id::text, 1, 8)) STORED; CREATE INDEX ... ON episodes(short_id);`
2. Same migration on `podcasts` table.
3. Utility `src/lib/episode-slug.ts` with `slugify`, `buildEpisodeUrl`, `parseEpisodeParam` (UUID or slug-shortid).
4. Update `/episode/[id]/insights/{layout,page}.tsx` to accept both UUID and slug-shortid formats. If slug-shortid, look up by `short_id` column.
5. Update all 29 internal link touchpoints to use `buildEpisodeUrl` helper.
6. Update sitemap to emit slug URLs.
7. Middleware/proxy: if request matches old UUID-only URL pattern, 301 redirect to canonical slug URL (preserves inbound link authority).
8. Regression test: /discover, /my-list, /summaries, all KnowledgeCard/InsightCard clicks, SMTP links, OG share links.
9. Deploy behind a feature flag initially to catch stragglers.

### Lever 2: Content Volume

Google ranks domains with:
- More content (deep summaries help — we have 3 paragraphs + key concepts + chapters)
- Fresh content (new summaries daily)
- Topic authority (30 episodes about "AI agents" → Google sees you as authority)

**Action:** Keep auto-summarizing. Don't stop.

### Lever 3: Backlinks (CRITICAL, hardest)

Without backlinks, won't rank for competitive queries. Launch playbook:

1. **Product Hunt launch** — 1 big backlink + traffic
2. **Hacker News "Show HN"** — 1 big backlink + traffic
3. **IndieHackers launch** — 1 backlink + community
4. **Twitter/LinkedIn** — link to specific summaries when podcasts drop new episodes
5. **Reddit** (carefully — r/podcasts, r/PodcastSharing, topic-specific subs when relevant)
6. **Podcast directory submissions** — listennotes.com, podchaser.com
7. **Guest posts** on podcast-adjacent blogs linking back to Yedapo

### Lever 4: Branded Search

Goal: users search "yedapo lex fridman ai" instead of "lex fridman ai summary".

- Consistent "Yedapo" use across all social media
- Claim handles: @yedapo on X/Twitter, Instagram, LinkedIn, TikTok, YouTube, Reddit
- Update JSON-LD `sameAs` in `src/app/layout.tsx` once handles claimed
- Long-term: Wikipedia entry once notability threshold met

### Lever 5: Long-Tail Targeting (Quick Wins)

Don't try to rank for "podcast summary" — impossible as a new site.

Target low-competition long-tail:
- "jensen huang nvidia interview summary"
- "lex fridman episode 421 takeaways"
- "all in podcast besties summary"
- "diary of a ceo steven bartlett episode XX"

These are low-competition and ownable within weeks of indexing.

---

## What NOT to Do

- **Don't** split to `app.yedapo.com` subdomain — fragments SEO authority, kills content-SEO thesis
- **Don't** try to rank for short broad keywords before building authority
- **Don't** buy backlinks (Google penalty risk)
- **Don't** auto-generate thin content just for SEO (spam)
- **Don't** `noindex` any summary pages (they're your ranking assets)

---

## Timelines

- **Week 1**: Technical fixes (schemas, sitemap, slugs) + Search Console setup
- **Month 1**: First batch of summaries starts appearing in Google (2-6 weeks typical)
- **Month 3**: Long-tail queries start ranking page 1
- **Month 6**: Brand name dominates branded searches
- **Month 12**: Competitive queries start ranking if backlink strategy executed

SEO is a **compounding** investment. First 30 days: no visible traffic. Month 6+: traffic doubles monthly.

---

## Key Files

| File | What it does |
|---|---|
| `src/app/sitemap.ts` | Generates sitemap.xml |
| `src/app/robots.ts` | Generates robots.txt |
| `src/app/layout.tsx` | Root metadata + Organization/WebSite JSON-LD |
| `src/app/episode/[id]/insights/layout.tsx` | Per-episode metadata + PodcastEpisode JSON-LD + sr-only content |
| `src/app/api/og/[id]/route.ts` | Dynamic OG image per episode |

---

## Reference Reading

- [Google Search Central docs](https://developers.google.com/search/docs)
- [schema.org PodcastEpisode](https://schema.org/PodcastEpisode)
- [schema.org VideoObject](https://schema.org/VideoObject)
- [Core Web Vitals](https://web.dev/articles/vitals)
- [IndexNow protocol](https://www.indexnow.org/)
