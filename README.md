# Yedapo

**Know what matters. AI-powered insights from podcasts and YouTube.**

Yedapo turns any podcast episode or YouTube video into a structured briefing in minutes: deep summary, chapter breakdown, key concepts, actionable takeaways, and a searchable transcript you can chat with.

🌐 **[yedapo.com](https://www.yedapo.com)**

---

## What Yedapo Does

- **AI Summaries** — Quick TLDR or comprehensive deep-dive for any podcast or YouTube episode.
- **Episode Insights** — Chapter breakdowns, core concepts, contrarian views, and action items, AI-generated.
- **Personalised Discovery** — A daily mix of summaries curated to your interests.
- **Podcasts + YouTube, unified** — Follow Apple Podcasts and YouTube channels side by side.
- **Ask AI** — Chat with any episode. Go deeper, fact-check, get a custom brief.
- **Global Summary Cache** — When one user summarises, everyone benefits.

---

## Getting Started

Yedapo is a hosted web app — no install needed.

👉 **[Sign up free at yedapo.com](https://www.yedapo.com)**

Works on any modern browser, desktop and mobile.

---

## For Contributors

### Prerequisites

- Node.js 22 (see `.nvmrc`)
- A Supabase project
- Upstash Redis instance
- API keys: Google Gemini, Deepgram, PostHog

### Local Setup

```bash
# Use the right Node version
nvm use

# Install dependencies
npm install

# Copy environment template
cp .env.local.example .env.local
# Fill in your API keys and Supabase credentials

# Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the Turbopack dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run test` | Run Vitest test suite |

### Deployment

Yedapo deploys to Vercel automatically on push to `main`. Every PR gets a Preview deployment.

---

## Tech Stack

Next.js 16 (App Router · Turbopack) · Supabase (Postgres + Auth + RLS) · Upstash Redis · Tailwind CSS · Google Gemini · Deepgram · PostHog · Vercel · Remotion (promo video)

---

## Contributing

1. Fork + branch from `main`
2. Open a PR back to `main`
3. CI runs lint + typecheck + tests; Vercel builds a Preview
4. Once green, merge

See [`.github/pull_request_template.md`](./.github/pull_request_template.md) for the PR checklist.

---

## License

Copyright © 2026 Yedapo. All rights reserved.

This repository is public for transparency. The source code is **not licensed for reuse, redistribution, or commercial use** without explicit written permission from the authors.
