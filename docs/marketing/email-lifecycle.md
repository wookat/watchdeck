# Email lifecycle (Resend)

Sender: `WatchDeck <watchdeck@zalize.com>`. Accent color `#7c3aed`. Red lines: only transactional or double-opt-in mail; every non-transactional mail carries List-Unsubscribe (RFC 8058) + footer link.

## Live today (implemented in src/email.ts / src/index.tsx)
1. **Signup welcome** (transactional, one-time) — sent on signup; explains Next Up/import; states "WatchDeck sends no marketing email".
2. **Updates-list confirmation** (double opt-in) — landing-page subscription sends a confirm link; no mail ever sent to unconfirmed addresses.
3. **Password reset** (transactional).
4. **Daily airing digest** (user opt-in on calendar page) — includes "Now streamable on your services"; one-click unsubscribe.

## Ready-to-wire templates (drafts — NOT to be sent without explicit boss approval, since "come back" mail to signups is marketing-adjacent; if wired, gate on the double-opt-in updates list only)

### A. Day-7 check-in (updates list subscribers only)
- Subject: `Your Next Up is waiting — anything missing?`
- Body: One week in — did your import go smoothly? Quick links: Next Up · Calendar (add the iCal feed) · Stats. One question, reply and a human reads it: what's the one thing you miss from your old tracker? — WatchDeck (footer: you're receiving this because you confirmed product updates at watchdeck.zalize.com · Unsubscribe)

### B. Wrapped-season announcement (updates list, once/year in December)
- Subject: `Your {year} Wrapped is ready 🎬`
- Body: Hours watched, top shows, busiest month, your streak — your year in TV & film is one page, and it's shareable. See your Wrapped → https://watchdeck.zalize.com/wrapped/{year} (footer: same as A)

### C. Feature announcement skeleton (updates list)
- Subject: `New in WatchDeck: {feature}`
- Body: 2 sentences what/why + one screenshot + one CTA link. Never more than one feature per mail; max ~1/month cadence.

## Rules of engagement
- Registered users who did NOT confirm the updates list receive only transactional mail (welcome, reset) and digests they explicitly enabled.
- No win-back mail to dormant accounts unless they're confirmed updates subscribers.
- Every template rendered on the shared inline-style pattern in src/email.ts; keep h2 `#7c3aed`, footer gray `#6b7280` 13px.
