import { ImageResponse, loadGoogleFont } from "workers-og";
import type { Env } from "./types";
import type { UserStats, WrappedStats } from "./views";

// workers-og renders text nodes verbatim (no entity decoding), so strip markup
// characters instead of entity-escaping them
function ogText(s: string): string {
  return s.replace(/[<>&]/g, " ").replace(/\s+/g, " ").trim();
}

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
  const html = `
  <div style="display:flex;flex-direction:column;width:1200px;height:630px;background:#020617;color:#f1f5f9;font-family:Inter;padding:64px;justify-content:space-between;">
    <div style="display:flex;flex-direction:column;">
      <span style="font-size:28px;color:#a78bfa;font-weight:700;">WatchDeck</span>
      <span style="font-size:52px;font-weight:700;margin-top:16px;">${ogText(name)}'s watch stats</span>
    </div>
    <div style="display:flex;gap:24px;">
      ${stat(stats.hoursWatched, "hours watched")}
      ${stat(stats.epsWatched, "episodes")}
      ${stat(stats.moviesWatched, "movies")}
      ${stat(stats.showsTracked, "shows tracked")}
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

export async function wrappedOgImage(env: Env, name: string, stats: WrappedStats): Promise<Response> {
  const [regular, bold] = await Promise.all([interFont(env, 400), interFont(env, 700)]);
  const posters = stats.topShows
    .filter((s) => s.poster_path)
    .slice(0, 5)
    .map(
      (s) =>
        `<img src="https://image.tmdb.org/t/p/w185${s.poster_path}" width="140" height="210" style="border-radius:14px;border:2px solid #4c1d95;" />`
    )
    .join("");
  const stat = (n: string, label: string) => `
    <div style="display:flex;flex-direction:column;align-items:center;padding:20px 30px;background:#1e1b4b;border-radius:20px;">
      <span style="font-size:48px;font-weight:700;color:#c4b5fd;">${n}</span>
      <span style="font-size:20px;color:#94a3b8;">${label}</span>
    </div>`;
  const html = `
  <div style="display:flex;flex-direction:column;width:1200px;height:630px;background:linear-gradient(180deg,#2e1065 0%,#020617 60%);color:#f1f5f9;font-family:Inter;padding:56px 64px;justify-content:space-between;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div style="display:flex;flex-direction:column;">
        <span style="font-size:26px;color:#a78bfa;font-weight:700;letter-spacing:6px;">WATCHDECK WRAPPED</span>
        <span style="font-size:72px;font-weight:700;margin-top:8px;">${stats.year}</span>
        <span style="font-size:26px;color:#cbd5e1;margin-top:4px;">${ogText(name)}'s year in TV and film</span>
      </div>
      <div style="display:flex;gap:12px;">${posters}</div>
    </div>
    <div style="display:flex;gap:20px;">
      ${stat(stats.hours.toLocaleString("en-US"), "hours")}
      ${stat(String(stats.eps), "episodes")}
      ${stat(String(stats.movies), "movies")}
      ${stats.topGenres[0] ? stat(ogText(stats.topGenres[0].name), "top genre") : ""}
    </div>
    <span style="font-size:22px;color:#64748b;">watchdeck.zalize.com — get your own Wrapped</span>
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

export async function listOgImage(
  env: Env,
  listName: string,
  owner: string,
  itemCount: number,
  posterPaths: string[]
): Promise<Response> {
  const [regular, bold] = await Promise.all([interFont(env, 400), interFont(env, 700)]);
  const posters = posterPaths
    .slice(0, 5)
    .map(
      (p) =>
        `<img src="https://image.tmdb.org/t/p/w185${p}" width="150" height="225" style="border-radius:14px;border:2px solid #334155;" />`
    )
    .join("");
  const html = `
  <div style="display:flex;flex-direction:column;width:1200px;height:630px;background:#020617;color:#f1f5f9;font-family:Inter;padding:64px;justify-content:space-between;">
    <div style="display:flex;flex-direction:column;">
      <span style="font-size:28px;color:#a78bfa;font-weight:700;">WatchDeck</span>
      <span style="font-size:52px;font-weight:700;margin-top:16px;">${ogText(listName)}</span>
      <span style="font-size:26px;color:#94a3b8;margin-top:8px;">a list by ${ogText(owner)} — ${itemCount} item${itemCount === 1 ? "" : "s"}</span>
    </div>
    <div style="display:flex;gap:20px;">${posters}</div>
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

export async function guideOgImage(env: Env, title: string, description: string, kicker = "WATCHDECK GUIDES"): Promise<Response> {
  const [regular, bold] = await Promise.all([interFont(env, 400), interFont(env, 700)]);
  const html = `
  <div style="display:flex;flex-direction:column;width:1200px;height:630px;background:linear-gradient(135deg,#020617 0%,#1e1b4b 100%);color:#f1f5f9;font-family:Inter;padding:72px;justify-content:space-between;">
    <span style="font-size:26px;color:#a78bfa;font-weight:700;letter-spacing:4px;">${ogText(kicker)}</span>
    <div style="display:flex;flex-direction:column;">
      <span style="font-size:58px;font-weight:700;line-height:1.15;">${ogText(title)}</span>
      <span style="font-size:28px;color:#94a3b8;margin-top:20px;line-height:1.4;">${ogText(description)}</span>
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
