import type { Env } from "./types";

// Global daily send breaker: caps total outbound email across all endpoints so no
// abuse pattern (or bug) can burn the Resend quota. Fail-closed past the cap.
const DAILY_EMAIL_CAP = 200;

export async function sendEmail(env: Env, to: string, subject: string, html: string, headers?: Record<string, string>): Promise<void> {
  if (!env.RESEND_API_KEY) return;
  const day = new Date().toISOString().slice(0, 10);
  const capKey = `rl:email-day:${day}`;
  const n = parseInt((await env.CACHE.get(capKey)) ?? "0", 10) + 1;
  if (n > DAILY_EMAIL_CAP) return;
  await env.CACHE.put(capKey, String(n), { expirationTtl: 172800 });
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "WatchDeck <watchdeck@zalize.com>", to: [to], subject, html, ...(headers ? { headers } : {}) }),
  }).catch(() => {});
}

export function confirmSignupEmail(siteUrl: string, token: string): [string, string] {
  const link = `${siteUrl}/confirm-email/${token}`;
  const html = `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
  <h2 style="color:#7c3aed">Confirm your WatchDeck updates subscription</h2>
  <p>You (or someone using your address) asked for WatchDeck product updates. Click below to confirm — we won't email you otherwise.</p>
  <p><a href="${link}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Confirm subscription</a></p>
  <p style="color:#6b7280;font-size:13px">If you didn't request this, ignore this email and you won't hear from us again.</p>
</div>`;
  return ["Confirm your WatchDeck updates subscription", html];
}

export function welcomeEmail(siteUrl: string): [string, string] {
  const html = `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
  <h2 style="color:#7c3aed">Welcome to WatchDeck 🎬</h2>
  <p>Your new home for tracking TV shows and movies on the web.</p>
  <p>Get started in 30 seconds:</p>
  <ul style="line-height:1.9">
    <li><a href="${siteUrl}/import" style="color:#7c3aed">Import your TV Time export ZIP</a> (or a Trakt/Serializd CSV) to pick up right where you left off</li>
    <li><a href="${siteUrl}/search" style="color:#7c3aed">Search</a> for any show or movie and start tracking</li>
    <li><a href="${siteUrl}/calendar" style="color:#7c3aed">Turn on air-date reminders</a> — email digest or iCal subscription</li>
  </ul>
  <p style="color:#6b7280;font-size:13px">You're receiving this one-time email because you just signed up at ${siteUrl}. WatchDeck sends no marketing email.</p>
</div>`;
  return ["Welcome to WatchDeck — pick up where you left off", html];
}

export function resetEmail(siteUrl: string, token: string): [string, string] {
  const link = `${siteUrl}/reset/${token}`;
  const html = `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
  <h2 style="color:#7c3aed">Reset your WatchDeck password</h2>
  <p>Someone (hopefully you) requested a password reset for this email address.</p>
  <p><a href="${link}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Choose a new password</a></p>
  <p style="color:#6b7280;font-size:13px">This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password is unchanged.</p>
</div>`;
  return ["Reset your WatchDeck password", html];
}
