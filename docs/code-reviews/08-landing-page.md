# Code Review #8 — Landing Page & Remotion Video

**Date:** 2026-04-03  
**Score:** 6.5/10  
**Scope:** `src/components/landing/*`, `src/app/pricing/*`, `src/lib/content/landing-copy.ts`, `video/src/*`

---

## How It Works

```
/ (root)  →  LandingPage.tsx
  ├── LandingNav       — fixed navbar, scroll state, auth modal trigger
  ├── Hero             — headline + CTAs + ProductMockup (Framer Motion on-mount)
  ├── HeroVideoShowcase — <video autoPlay muted loop controls> → /yedapo-promo.mp4
  ├── Features         — 4 alternating rows (ScrollReveal) → LANDING_COPY.features
  ├── HowItWorks       — 3-step grid (StaggerContainer/StaggerItem)
  ├── SocialProof      — trust signals bar
  ├── UseCases         — 3 persona cards
  ├── Testimonials     — quote cards
  ├── PricingCTA       — plan comparison teaser → /pricing
  ├── FinalCTA         — dark section with particle animations
  └── LandingFooter    — Server Component, copyright year, social links (⚠️ dead)

/pricing  →  RSC: PricingCard × 2 (Free / Pro)

video/src/ (Remotion):
  Root.tsx → YedapoPromo.tsx → 7 scenes (BrandIntro, PainPoint, SummaryDemo,
             FeatureShowcase ×2, CtaFinale) with design.ts constants
```

---

## Issues Found

### 🔴 Critical

**1. `video/src/Root.tsx:18` — `TRANSITION_OVERLAP = 88` שגוי — exported video מסתיים בקיפאון שחור של 1.73 שניות**  
`TRANSITION_OVERLAP` חושב לפי V1 durations. `YedapoPromo.tsx` משתמש ב-`FADE_FAST=20`, `FADE_LONG=30` עם 6 transitions:
```
2×30 + 4×20 = 140  (נכון)
88             (כרגע — שגוי)
→ 52 frames יתר = 1.73s של שחור בסוף כל export
```
**Fix:** שנה ל-`const TRANSITION_OVERLAP = 140` או גזור מה-constants של `YedapoPromo.tsx`.

**2. `src/lib/content/landing-copy.ts:120` — טקסט שיווקי מציין 5 summaries/day, המגבלה האמיתית היא 3**  
```ts
pricingCta.description: "5 AI summaries per day, forever free."
// PLAN_LIMITS.free.summariesPerDay = 3  (src/lib/plans.ts:18)
```  
דף `/pricing` מציג נכון `3` (כי קורא מ-`PLAN_LIMITS`). שני המספרים גלויים בו-זמנית לכל מבקר. משתמש שנרשם ציפה ל-5 — יקבל 3. Confidence: **100**.

---

### 🟠 Important

3. **`src/components/landing/HeroVideoShowcase.tsx:73` — `preload="auto"` על קובץ וידאו גדול**  
הדפדפן מוריד את כל ה-MP4 בטעינת הדף (likely 20–80 MB). מדרדר LCP ו-TTI, במיוחד במובייל.  
**Fix:** שנה ל-`preload="metadata"`.

4. **`src/components/landing/ScrollReveal.tsx:94-123` — `StaggerItem` מאניה גם כשuser מבקש `prefers-reduced-motion`**  
`StaggerContainer` עובר ל-plain `<div>` ב-reduced-motion. אבל `StaggerItem` תמיד מרנדר `motion.div` עם variants — ללא parent variant context התוצאה היא `opacity: 0` קבוע או animation בלתי צפויה. Confidence: **85**.  
**Fix:** `StaggerItem` צריך גם לקרוא ל-`useReducedMotion()` ולהחזיר plain `<div>`.

5. **`src/components/landing/LandingFooter.tsx:16-17` — Social links עם `href: '#'`**  
Twitter ו-GitHub פותחים tab חדש שמנווט ל-`#` של הדף הנוכחי. גלוי לכל מבקר שלוחץ. Confidence: **95**.  
**Fix:** להחליף ב-URLs אמיתיים או להסיר את העמודה.

6. **`src/app/pricing/PricingCard.tsx:197-203` — Free plan מציג "Current Plan" לכל מבקר, כולל לא-רשומים**  
```tsx
<Button disabled>Current Plan</Button>  // ← ללא בדיקת auth
```  
מבקר שלא נרשם רואה "Current Plan" — נראה שכבר יש לו חשבון. פוגע ב-conversion. Confidence: **88**.  
**Fix:** אם `!user` → `<Button>Get Started Free</Button>` שמנווט ל-`/discover`.

7. **`video/src/scenes/CtaFinale.tsx:213` — URL `yedapo.app` בaked-in ב-video**  
אם הדומיין בפועל שונה, ה-exported MP4 יציג URL שגוי לצמיתות.

---

### 🟡 Minor

- **`FinalCTA.tsx:36-51`** — 8 particle animations ללא `useReducedMotion()` (היחיד ב-landing ללא guard)
- **`HeroVideoShowcase.tsx`** — `autoPlay` + `controls` ביחד: UX tension בין ambient reel לplayer
- **`Features.tsx:13-14`** — VISUALS array coupled ל-copy array by index בשקט — אם נוסף feature ללא visual, runtime throw
- **`LandingFooter.tsx:21`** — `new Date().getFullYear()` מחושב ב-build time → שנה שגויה בינואר עד deploy הבא

---

## מה טוב

- **Motion accessibility עקבי** — Hero, HowItWorks, ProductMockup, ScrollReveal כולם עם `useReducedMotion()` fallback
- **Pricing data מ-single source of truth** — `pricing/page.tsx` קורא נכון מ-`PLAN_LIMITS`
- **Remotion architecture** — `design.ts` מרכז כל timing constants, scenes composable individually, style עקבי ב-7 scenes

---

## Top 3 Fixes (Priority Order)

1. **Remotion `TRANSITION_OVERLAP = 88`** — כל export של הוידאו מסתיים ב-1.73s קיפאון שחור
2. **Landing copy: "5 summaries" vs actual limit 3** — broken promise לכל משתמש חדש
3. **`preload="auto"` על הוידאו** — מוריד עשרות MB בכל טעינת landing page
