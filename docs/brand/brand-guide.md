# WatchDeck Brand Guide

## 1. Brand story & positioning

**One-liner (for the target audience):** WatchDeck is the web home for your TV life — drop in your TV Time export and be back on your next episode in 30 seconds.

**Story:** When TV Time shut down (July 15), millions of people were left holding years of watch history — every episode, every rating, every rewatch — with nowhere good to put it. WatchDeck exists for them: a web-first tracker that imports the TV Time GDPR ZIP (plus Trakt/Serializd/Netflix CSVs) losslessly and immediately answers the only question that matters: *what do I watch next?* No app to install, no ads, data exportable any time.

**Positioning vs competitors:**
- vs Hobi/Showly (mobile apps): WatchDeck is web-first — works everywhere, nothing to install.
- vs Trakt: features Trakt charges VIP for (year in review, monthly stats, unlimited lists) are included.
- vs Letterboxd/Serializd: covers TV *and* movies in one place, with episode-level tracking.

**Audience:** TV Time refugees and heavy episode-trackers. They care about their history being complete, knowing what's next, and airing dates. Tone should respect that their watch history is *precious data*, not throwaway.

## 2. Naming & copy rules

- Product name: **WatchDeck** — one word, capital W and D. Never "Watchdeck", "Watch Deck", "WD".
- Feature names (canonical, capitalized as shown): **Next Up**, **Library**, **Lists**, **Calendar**, **Import**, **History**, **Stats**, **Wrapped**, **Month in review**, **Surprise me** (roulette).
- Pricing language: WatchDeck is **"free while in beta"** / a **"Beta free trial"** — never plain "free" as a positioning ("free forever", "always free" are forbidden except for the data-export promise "Full data export — always free"). Paid plan is **Plus** ($1.99/mo · $19/yr).
- Signup CTA: "Join the beta". Import CTA: "Import my TV Time data".
- Email sender: `WatchDeck <watchdeck@zalize.com>`. Contact address in all legal/press copy: watchdeck@zalize.com.

**Tone of voice:** direct, warm, a little cinephile — sentences a fan would say, not marketing-speak. Talk about *their* shows and *their* history ("pick up where you left off", "your data stays yours"). No hype words ("revolutionary", "game-changing", "AI-powered"), no exclamation-mark stacking, no dark patterns ("only 3 spots left"). British/US neutral English, sentence case for headings.

**Forbidden claims:** anything implying endorsement by TV Time or TMDB ("This product uses the TMDB API but is not endorsed or certified by TMDB" must appear wherever TMDB data is credited); "official TV Time successor"; guaranteed availability; "free forever".

## 3. Visual identity

- **Logo:** violet clapperboard with a play triangle (`public/favicon.svg`, PNG renders `icon-192.png`/`icon-512.png`/`apple-touch-icon.png`). Wordmark = logo + "WatchDeck" in bold tracking-tight. Don't recolor, skew or add effects; keep clear space ≥ the play triangle's width.
- **Colors:** primary violet `#7c3aed` (Tailwind violet-600), accent gradient violet-400 → fuchsia-400, background near-black `#020617` (slate-950), surfaces slate-900/50 with slate-800 borders, body text slate-100/300, secondary slate-400 (min WCAG AA on slate-950).
- **Typography:** system UI stack (Tailwind default), extrabold tracking-tight for heroes, semibold for card titles, `text-sm text-slate-400` for supporting copy.
- **Spacing/shape:** cards `rounded-2xl border border-slate-800 bg-slate-900/50 p-6`; small chips `rounded-full`; page width `max-w-6xl`; content pages `max-w-2xl`.
- **Imagery:** real TMDB posters/backdrops are the brand's texture (poster wall, hover lift + violet glow). Empty states use the self-drawn clapperboard illustration. Never use copyrighted third-party promo art outside TMDB's API terms.
- **Motion:** CSS-only, subtle (rise-in, hover lift); everything degrades under `prefers-reduced-motion`.
- **OG/social:** default card `public/og-default.png` (1200×630); dynamic cards (stats/lists/Wrapped) are generated with workers-og in the same palette.

## 4. Brand surface checklist (audit these when anything changes)

| Surface | Canonical copy |
|---|---|
| `<title>` default | "WatchDeck — Track your TV shows & movies on the web" |
| Meta description default | "…web-first TV show and movie tracker, free while in beta…" |
| og:site_name | WatchDeck |
| Footer line 1 | "WatchDeck — web-first TV & movie tracking, free while in beta." |
| Footer links | About & Press · Pricing · Privacy · Terms + TMDB attribution |
| Email from | `WatchDeck <watchdeck@zalize.com>` |
| Email accent color | `#7c3aed` headings |
| /about | brand story + press kit (boilerplate, logo downloads, colors) |

Last audited: 2026-08-05 (Round 161) — all surfaces consistent.
