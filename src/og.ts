import { ImageResponse, loadGoogleFont } from "workers-og";
import type { Env } from "./types";
import type { UserStats } from "./views";

async function interFont(env: Env, weight: number): Promise<ArrayBuffer> {
  const key = `font:inter:${weight}`;
  const cached = await env.CACHE.get(key, "arrayBuffer");
  if (cached) return cached;
  const buf = await loadGoogleFont({ family: "Inter", weight });
  await env.CACHE.put(key, buf, { expirationTtl: 30 * 24 * 3600 });
  return buf;
}

export async function shareOgImage(env: Env, name: string, stats: UserStats): Promise<Response> {
  const [regular, bold] = await Promise.all([interFont(env, 400), interFont(env, 700)]);
  const stat = (n: number, label: string) => `
    <div style="display:flex;flex-direction:column;align-items:center;padding:24px 36px;background:#1e293b;border-radius:20px;">
      <span style="font-size:56px;font-weight:700;color:#c4b5fd;">${n}</span>
      <span style="font-size:22px;color:#94a3b8;">${label}</span>
    </div>`;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `
  <div style="display:flex;flex-direction:column;width:1200px;height:630px;background:#020617;color:#f1f5f9;font-family:Inter;padding:64px;justify-content:space-between;">
    <div style="display:flex;flex-direction:column;">
      <span style="font-size:28px;color:#a78bfa;font-weight:700;">WatchDeck</span>
      <span style="font-size:52px;font-weight:700;margin-top:16px;">${esc(name)}'s watch stats</span>
    </div>
    <div style="display:flex;gap:24px;">
      ${stat(stats.epsWatched, "episodes")}
      ${stat(stats.moviesWatched, "movies")}
      ${stat(stats.showsTracked, "shows tracked")}
      ${stat(stats.completedShows, "completed")}
    </div>
    <span style="font-size:24px;color:#64748b;">watchdeck.zalize.com — track your TV shows and movies on the web</span>
  </div>`;
  return new ImageResponse(html, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Inter", data: regular, weight: 400, style: "normal" },
      { name: "Inter", data: bold, weight: 700, style: "normal" },
    ],
  });
}
