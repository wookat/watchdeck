import { unzipSync, strFromU8 } from "fflate";

export interface ParsedShow {
  name: string;
  episodes: { season: number; episode: number; watchedAt: string | null }[];
  followedOnly: boolean;
}

export interface ParsedImport {
  shows: ParsedShow[];
  movies: { name: string; watchedAt: string | null }[];
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((f) => f !== "")) rows.push(row);
  }
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, idx) => [h, (r[idx] ?? "").trim()])));
}

function pick(rec: Record<string, string>, ...candidates: string[]): string {
  for (const cand of candidates) {
    if (rec[cand]) return rec[cand];
  }
  for (const cand of candidates) {
    for (const key of Object.keys(rec)) {
      if (key.includes(cand) && rec[key]) return rec[key];
    }
  }
  return "";
}

// Generic CSV import (Trakt / Serializd and similar exports):
// needs a title column; season/episode and watched-date columns are optional.
export function parseGenericCsv(text: string): ParsedImport {
  const records = parseCsv(text);
  const showMap = new Map<string, ParsedShow>();
  const movies = new Map<string, { name: string; watchedAt: string | null }>();
  for (const rec of records) {
    const type = pick(rec, "type", "media_type", "entity_type").toLowerCase();
    const title = pick(rec, "title", "show title", "show_title", "show name", "show_name", "show", "series_name", "name");
    if (!title) continue;
    const season = parseInt(pick(rec, "season number", "season_number", "season"), 10);
    const episode = parseInt(pick(rec, "episode number", "episode_number", "episode"), 10);
    const watchedAt = pick(rec, "watched_at", "watched at", "watched date", "last_watched_at", "date", "created_at") || null;
    if (type.includes("movie")) {
      if (!movies.has(title.toLowerCase())) movies.set(title.toLowerCase(), { name: title, watchedAt });
      continue;
    }
    const key = title.toLowerCase();
    let show = showMap.get(key);
    if (!show) {
      show = { name: title, episodes: [], followedOnly: true };
      showMap.set(key, show);
    }
    if (Number.isFinite(season) && Number.isFinite(episode)) {
      show.followedOnly = false;
      show.episodes.push({ season, episode, watchedAt });
    }
  }
  for (const show of showMap.values()) {
    const seen = new Set<string>();
    show.episodes = show.episodes.filter((e) => {
      const k = `${e.season}x${e.episode}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  return { shows: [...showMap.values()], movies: [...movies.values()] };
}

// Netflix ViewingActivity.csv: exactly Title,Date columns.
// Episode rows look like "Show: Season 1: Episode Name" — Netflix gives no episode
// numbers, so shows are imported as followed and standalone titles as movies.
export function isNetflixCsv(text: string): boolean {
  const header = text.slice(0, 200).split(/\r?\n/)[0].toLowerCase().replace(/"/g, "").trim();
  return header === "title,date";
}

export function parseNetflixCsv(text: string): ParsedImport {
  const records = parseCsv(text);
  const showMap = new Map<string, ParsedShow>();
  const movies = new Map<string, { name: string; watchedAt: string | null }>();
  const seasonRe = /:\s*(season\s*\d+|part\s*\d+|series\s*\d+|volume\s*\d+|limited series|chapter\s*\d+)/i;
  for (const rec of records) {
    const title = rec["title"];
    if (!title) continue;
    const watchedAt = rec["date"] || null;
    const m = title.match(seasonRe);
    if (m || title.split(": ").length >= 3) {
      const name = (m ? title.slice(0, m.index) : title.split(": ")[0]).trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!showMap.has(key)) showMap.set(key, { name, episodes: [], followedOnly: true });
    } else {
      const key = title.toLowerCase();
      if (!movies.has(key)) movies.set(key, { name: title, watchedAt });
    }
  }
  return { shows: [...showMap.values()], movies: [...movies.values()] };
}

export function parseTvTimeZip(zipBytes: Uint8Array): ParsedImport {
  const files = unzipSync(zipBytes);
  const csvs: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(files)) {
    if (name.toLowerCase().endsWith(".csv")) csvs[name.split("/").pop()!.toLowerCase()] = strFromU8(bytes);
  }
  return parseTvTimeCsvs(csvs);
}

export function parseTvTimeCsvs(csvs: Record<string, string>): ParsedImport {
  const showMap = new Map<string, ParsedShow>();
  const movies = new Map<string, { name: string; watchedAt: string | null }>();

  const getShow = (name: string): ParsedShow => {
    const key = name.toLowerCase();
    let s = showMap.get(key);
    if (!s) {
      s = { name, episodes: [], followedOnly: true };
      showMap.set(key, s);
    }
    return s;
  };

  for (const [fname, text] of Object.entries(csvs)) {
    const records = parseCsv(text);
    if (fname.includes("tracking")) {
      for (const rec of records) {
        const type = pick(rec, "entity_type", "type", "series_type").toLowerCase();
        const movieName = pick(rec, "movie_name", "movie_title");
        const showName = pick(rec, "tv_show_name", "series_name", "show_name", "series_title");
        const watchedAt = pick(rec, "watched_at", "created_at", "date") || null;
        if (movieName || type.includes("movie")) {
          const name = movieName || showName;
          if (name && !movies.has(name.toLowerCase())) movies.set(name.toLowerCase(), { name, watchedAt });
          continue;
        }
        if (!showName) continue;
        const season = parseInt(pick(rec, "episode_season_number", "season_number", "season"), 10);
        const episode = parseInt(pick(rec, "episode_number", "episode"), 10);
        const show = getShow(showName);
        if (Number.isFinite(season) && Number.isFinite(episode)) {
          show.followedOnly = false;
          show.episodes.push({ season, episode, watchedAt });
        }
      }
    } else if (fname.includes("followed")) {
      for (const rec of records) {
        const showName = pick(rec, "tv_show_name", "series_name", "show_name", "name", "title");
        if (showName) getShow(showName);
      }
    }
  }

  for (const show of showMap.values()) {
    const seen = new Set<string>();
    show.episodes = show.episodes.filter((e) => {
      const k = `${e.season}x${e.episode}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  return { shows: [...showMap.values()], movies: [...movies.values()] };
}
