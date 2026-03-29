# Yedapo Pricing Strategy Report
### 7-Agent Analysis — March 24, 2026

---

## EXECUTIVE DECISION

All 7 agents **unanimously recommend switching to 2 tiers** (Free + one paid). The disagreement is only on price point.

| Agent | Recommended Price | Annual Price |
|-------|------------------|-------------|
| Finance Tracker | **$9.99/mo** | not specified |
| Trend Researcher | **$6.99/mo** | $49.99/yr |
| Executive Summary | **$8.99/mo** | $79/yr |
| Feedback Synthesizer | **$7.99/mo** | $59.99/yr |
| Tool Evaluator | **$7.99/mo** | $69.99/yr |
| Support Responder | no specific price | — |
| Accounts Payable | no specific price | — |

**Consensus range: $6.99-$9.99/mo**, with the center of gravity at **$7.99-$8.99/mo**.

---

## 1. COMPETITIVE LANDSCAPE (Trend Researcher)

| Competitor | Free Tier | Paid Price | Model |
|-----------|-----------|------------|-------|
| **Snipd** | 2 AI eps/week | $6.99/mo | 2-tier |
| **Podwise** | 4 AI eps/month | $5.90-$11.90/mo | 3-tier |
| **Recall** | 10 summaries total | $7/mo | 2-tier |
| **Summarize.tech** | ~3 videos/day | $10/mo | 2-tier |
| **NoteGPT** | 15 requests/month | $9.99-$99/mo | 4-tier |

**Key patterns**: $7-10/mo sweet spot. 2-tier wins for consumer products. The market is swinging back toward predictable flat-rate pricing after the 2025 credits/tokens backlash.

---

## 2. UNIT ECONOMICS (Finance Tracker)

### Per-Summary Costs

| Component | Cost |
|-----------|------|
| Gemini AI (summary pipeline) | ~$0.017/episode |
| Deepgram (when needed, ~40% of episodes) | ~$0.19/episode |
| Ask AI per question | ~$0.0025 |
| **Blended average per summary** | **~$0.05** |

### Breakeven Analysis

| Price Point | Gross Margin/User | Breakeven (with $5K salary) |
|------------|-------------------|---------------------------|
| $5.99/mo | $1.89 | 2,677 paying users |
| $7.99/mo | $3.89 | 1,301 paying users |
| $9.99/mo | $5.89 | 859 paying users |

### When Does "Unlimited" Become Unprofitable?

| Price | Max Summaries Before Loss | Daily Equivalent |
|-------|--------------------------|------------------|
| $7.99/mo | 159/month | ~5/day |
| $9.99/mo | 199/month | ~6-7/day |

**Critical finding**: The free tier cap matters MORE than the paid tier price. Reducing free from 5 to 3 summaries/month swings 10K MAU from -$718/mo loss to +$252/mo profit.

---

## 3. INFRASTRUCTURE COSTS (Accounts Payable)

### Cost by Scale

| Scale | Monthly Cost | Revenue (10% conv) | Net |
|-------|-------------|-------------------|-----|
| 100 users | $82 | $110 | +$28 |
| 1,000 users | $440 | $1,099 | +$459 |
| 10,000 users | $1,900 | $10,998 | +$5,798 |

### Cost Per User Type

| User Type | Monthly Cost |
|-----------|-------------|
| Average free user | ~$2.41 |
| Average pro user | ~$4.70 |
| Heavy power user | ~$11.83 |
| Whale (15+/day) | ~$24.60 |

**Biggest cost lever**: Deepgram is 10x more expensive than Gemini ($0.19 vs $0.017 per episode). Gating Deepgram behind paid tier could cut variable costs 40-50%.

---

## 4. THE KILLER UPGRADE TRIGGER (Feedback Synthesizer)

What does NOT drive upgrades:
- More summaries (quantity alone is weak)
- Better quality (hard to demonstrate pre-purchase)
- Speed (podcast summaries aren't urgent)

**What DOES drive upgrades, ranked**:
1. **"Ask AI about this episode"** -- the strongest differentiator
2. **Cross-episode intelligence** -- "What have all my podcasts said about X?"
3. **Export** (Notion, Obsidian, Readwise)
4. **Actionable outputs** (action items with direct links)

**Recommendation**: Free users get full summaries. **Gate "Ask AI" behind Pro**.

---

## 5. TECHNICAL IMPACT (Tool Evaluator)

### Migration Scope: ~7 files, ~80 lines deleted

| Area | Files | Change |
|------|-------|--------|
| Plan definitions | 1 | Remove 'power' type and entries |
| Client hook | 1 | Remove isPower boolean |
| Sidebar badge | 1 | Remove amber color branch |
| Pricing page | 1 | Remove 3rd card, 2-column layout |
| Admin panel | 1 | Remove from plan selector |
| Server plan resolution | 1 | Change admin fallback |
| DB migration | 1 | UPDATE power->pro, alter CHECK |

### Technical Recommendations
- Keep Redis daily counters (already built)
- Soft cap: 200 summaries/day, 500 Ask AI/day (displayed as "Unlimited")
- Stripe: Single product, 2 prices (monthly + yearly), webhook-driven

---

## 6. SUPPORT FRICTION (Support Responder)

Moving to 2 tiers eliminates the #1 support ticket: "which plan do I need?"

### Critical UX Recommendations
1. Show remaining quota persistently near Summarize button
2. Graceful limit state, not error messages
3. 80% warning with gentle upgrade nudge
4. Name it "Yedapo Pro" not just "Unlimited"
5. Previously generated summaries stay accessible forever

---

## 7. STRATEGY BRIEF (Executive Summary)

### Why Simplify Now
- Pre-PMF: every pricing decision point is a conversion leak
- The $14.99 Power tier lacks market precedent
- Segmentation is a scaling problem, not a launch problem

### When to Re-Add Tiers (all 3 must be true)
1. 500+ active paid subscribers
2. Clear bimodal usage pattern (top 10% consume 5x+ median)
3. A feature set power users want but casual users don't

### Go-to-Market Message
> "Stop choosing plans. Start understanding podcasts."

---

## UNIFIED RECOMMENDATION

| Decision | Recommendation |
|----------|---------------|
| **Model** | 2-tier: Free + Yedapo Pro |
| **Price** | **$8.99/mo** / $69.99/yr (27% discount) |
| **Free tier** | 3 summaries/day, full quality |
| **Free excludes** | Ask AI, cross-episode search, export, action items |
| **Pro tier** | "Unlimited" (soft cap: 200/day summaries, 500/day Ask AI) |
| **Killer trigger** | Ask AI -- gate behind Pro |
| **Abuse protection** | 200/day soft cap + 5 req/min rate limit |
| **Cost control** | Gate Deepgram behind Pro |
| **Technical effort** | ~7 files, ~80 lines deleted, 1 SQL migration |
| **Stripe** | Single product, 2 prices, webhook -> plan column |
| **Ship target** | April 7, 2026 |
| **Re-evaluate** | At 500+ paid subscribers with bimodal usage |
