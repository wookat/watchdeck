import type { Env } from "./types";

const BASE = "https://api.themoviedb.org/3";
export const IMG = "https://image.tmdb.org/t/p";

const SWR_GRACE = 7 * 24 * 3600;

interface SwrEntry<T> {
  __swr: number;
  d: T;
}

async function fetchAndCache<T>(env: Env, path: string, cacheKey: string, ttl: number): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${env.TMDB_READ_TOKEN}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${path}`);
  const data = (await res.json()) as T;
  const entry: SwrEntry<T> = { __swr: Math.floor(Date.now() / 1000) + ttl, d: data };
  await env.CACHE.put(cacheKey, JSON.stringify(entry), { expirationTtl: ttl + SWR_GRACE });
  return data;
}

async function tmdb<T>(env: Env, path: string, ttl = 6 * 3600): Promise<T> {
  const cacheKey = `tmdb:${path}`;
  const cached = (await env.CACHE.get(cacheKey, "json")) as SwrEntry<T> | T | null;
  if (cached !== null && typeof cached === "object" && "__swr" in (cached as object)) {
    const entry = cached as SwrEntry<T>;
    if (entry.__swr < Math.floor(Date.now() / 1000)) {
      const refresh = fetchAndCache<T>(env, path, cacheKey, ttl).catch(() => {});
      if (env.waitUntil) env.waitUntil(refresh);
    }
    return entry.d;
  }
  if (cached !== null && cached !== undefined) return cached as T;
  return fetchAndCache<T>(env, path, cacheKey, ttl);
}

export interface SearchResult {
  id: number;
  media_type?: string;
  name?: string;
  title?: string;
  poster_path: string | null;
  profile_path?: string | null;
  first_air_date?: string;
  release_date?: string;
  overview?: string;
  vote_average?: number;
}

export function searchMulti(env: Env, query: string) {
  return tmdb<{ results: SearchResult[] }>(env, `/search/multi?query=${encodeURIComponent(query)}&include_adult=false`);
}

export function searchPerson(env: Env, query: string) {
  return tmdb<{ results: SearchResult[] }>(env, `/search/person?query=${encodeURIComponent(query)}&include_adult=false`, 3600);
}

export function searchTv(env: Env, query: string) {
  return tmdb<{ results: SearchResult[] }>(env, `/search/tv?query=${encodeURIComponent(query)}&include_adult=false`, 7 * 24 * 3600);
}

export function searchMovie(env: Env, query: string) {
  return tmdb<{ results: SearchResult[] }>(env, `/search/movie?query=${encodeURIComponent(query)}&include_adult=false`, 7 * 24 * 3600);
}

export interface TvDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  last_air_date: string;
  status: string;
  vote_average: number;
  vote_count: number;
  genres: { id: number; name: string }[];
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: { season_number: number; episode_count: number; name: string; poster_path: string | null; air_date: string | null }[];
  next_episode_to_air: { season_number: number; episode_number: number; air_date: string; name: string; episode_type?: string } | null;
  created_by?: { id: number; name: string }[];
  episode_run_time: number[];
  last_episode_to_air: { runtime: number | null } | null;
}

export function tvDetails(env: Env, id: number) {
  return tmdb<TvDetails>(env, `/tv/${id}`, 12 * 3600);
}

export interface SeasonDetails {
  season_number: number;
  episodes: { episode_number: number; season_number: number; name: string; air_date: string | null; overview: string }[];
}

export function seasonDetails(env: Env, tvId: number, season: number) {
  return tmdb<SeasonDetails>(env, `/tv/${tvId}/season/${season}`, 12 * 3600);
}

export interface MovieDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number | null;
  vote_average: number;
  vote_count: number;
  genres: { id: number; name: string }[];
  status: string;
}

export function movieDetails(env: Env, id: number) {
  return tmdb<MovieDetails>(env, `/movie/${id}`, 24 * 3600);
}

export function trendingTv(env: Env) {
  return tmdb<{ results: SearchResult[] }>(env, `/trending/tv/week`, 12 * 3600);
}

export function trendingMovies(env: Env) {
  return tmdb<{ results: SearchResult[] }>(env, `/trending/movie/week`, 12 * 3600);
}

export function genreList(env: Env, type: "tv" | "movie") {
  return tmdb<{ genres: { id: number; name: string }[] }>(env, `/genre/${type}/list`, 7 * 24 * 3600);
}

export function discoverByYear(env: Env, type: "tv" | "movie", year: number, page = 1) {
  const param = type === "tv" ? `first_air_date_year=${year}` : `primary_release_year=${year}`;
  return tmdb<{ results: SearchResult[]; total_pages: number }>(
    env,
    `/discover/${type}?${param}&sort_by=popularity.desc&page=${Math.min(Math.max(page, 1), 20)}`,
    24 * 3600
  );
}

export const NETWORKS = [
  { id: 213, name: "Netflix" },
  { id: 49, name: "HBO" },
  { id: 2739, name: "Disney+" },
  { id: 2552, name: "Apple TV+" },
  { id: 1024, name: "Prime Video" },
  { id: 453, name: "Hulu" },
  { id: 4330, name: "Paramount+" },
  { id: 3353, name: "Peacock" },
  { id: 174, name: "AMC" },
  { id: 88, name: "FX" },
  { id: 67, name: "Showtime" },
  { id: 4, name: "BBC One" },
] as const;

export function discoverByNetwork(env: Env, networkId: number, page = 1) {
  return tmdb<{ results: SearchResult[]; total_pages: number }>(
    env,
    `/discover/tv?with_networks=${networkId}&sort_by=popularity.desc&page=${Math.min(Math.max(page, 1), 20)}`,
    24 * 3600
  );
}

export function discoverByGenre(env: Env, type: "tv" | "movie", genreId: number, page = 1) {
  return tmdb<{ results: SearchResult[]; total_pages: number }>(
    env,
    `/discover/${type}?with_genres=${genreId}&sort_by=popularity.desc&page=${Math.min(Math.max(page, 1), 20)}`,
    24 * 3600
  );
}

export function topRated(env: Env, type: "tv" | "movie", page = 1) {
  return tmdb<{ results: SearchResult[]; total_pages: number }>(env, `/${type}/top_rated?page=${Math.min(Math.max(page, 1), 20)}`, 24 * 3600);
}

export function upcomingMovies(env: Env, page = 1) {
  return tmdb<{ results: SearchResult[]; total_pages: number }>(env, `/movie/upcoming?page=${Math.min(Math.max(page, 1), 20)}`, 12 * 3600);
}

export function onTheAirTv(env: Env, page = 1) {
  return tmdb<{ results: SearchResult[]; total_pages: number }>(env, `/tv/on_the_air?page=${Math.min(Math.max(page, 1), 20)}`, 12 * 3600);
}

export function discoverPopular(env: Env, type: "tv" | "movie", page = 1) {
  return tmdb<{ results: SearchResult[]; total_pages: number }>(
    env,
    `/discover/${type}?sort_by=popularity.desc&page=${Math.min(Math.max(page, 1), 20)}`,
    24 * 3600
  );
}

export interface WatchProviders {
  link: string;
  flatrate?: { provider_id: number; provider_name: string; logo_path: string }[];
}

// curated US streaming services users can pick as "my services" (TMDB provider ids)
export const STREAMING_SERVICES: [number, string][] = [
  [8, "Netflix"],
  [9, "Prime Video"],
  [337, "Disney+"],
  [15, "Hulu"],
  [1899, "HBO Max"],
  [350, "Apple TV+"],
  [531, "Paramount+"],
  [386, "Peacock Premium"],
  [283, "Crunchyroll"],
  [43, "Starz"],
];

export function popularPeople(env: Env, page = 1) {
  return tmdb<{ results: { id: number; name: string; profile_path: string | null }[] }>(
    env,
    `/person/popular?page=${Math.min(Math.max(page, 1), 10)}`,
    24 * 3600
  );
}

export async function watchProviders(env: Env, type: "tv" | "movie", id: number, region = "US"): Promise<WatchProviders | null> {
  const res = await tmdb<{ results: Record<string, WatchProviders | undefined> }>(env, `/${type}/${id}/watch/providers`, 24 * 3600);
  return res.results[region] ?? null;
}

export async function trailerUrl(env: Env, type: "tv" | "movie", id: number): Promise<string | null> {
  const data = await tmdb<{ results: { site: string; type: string; key: string; official: boolean }[] }>(
    env,
    `/${type}/${id}/videos`,
    7 * 24 * 3600
  );
  const yt = data.results.filter((v) => v.site === "YouTube" && v.type === "Trailer");
  const best = yt.find((v) => v.official) ?? yt[0];
  return best ? `https://www.youtube.com/watch?v=${best.key}` : null;
}

export function recommendations(env: Env, type: "tv" | "movie", id: number) {
  return tmdb<{ results: SearchResult[] }>(env, `/${type}/${id}/recommendations`, 24 * 3600);
}

export function metaDescription(text: string | null | undefined, max = 155): string | undefined {
  if (!text) return undefined;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 80 ? lastSpace : max).replace(/[,.;:\s]+$/, "")}\u2026`;
}

export function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "title";
}

export function poster(path: string | null, size = "w342"): string {
  return path ? `${IMG}/${size}${path}` : "/placeholder-poster.svg";
}

export interface CastMember {
  id: number;
  name: string;
  character: string | null;
  profile_path: string | null;
}

export interface PersonDetails {
  id: number;
  name: string;
  biography: string | null;
  profile_path: string | null;
  known_for_department: string | null;
  birthday: string | null;
}

export interface PersonCredit {
  id: number;
  media_type: "tv" | "movie";
  title?: string;
  name?: string;
  poster_path: string | null;
  vote_count: number;
  popularity: number;
  character?: string | null;
}

export async function personDetails(env: Env, id: number): Promise<PersonDetails> {
  return tmdb<PersonDetails>(env, `/person/${id}`, 7 * 24 * 3600);
}

export async function personCredits(env: Env, id: number, limit = 24): Promise<PersonCredit[]> {
  const res = await tmdb<{ cast: PersonCredit[] }>(env, `/person/${id}/combined_credits`, 7 * 24 * 3600);
  const seen = new Set<string>();
  return (res.cast ?? [])
    .filter((c) => (c.media_type === "tv" || c.media_type === "movie") && c.poster_path)
    .filter((c) => {
      const k = `${c.media_type}:${c.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.vote_count - a.vote_count || b.popularity - a.popularity)
    .slice(0, limit);
}

export async function movieDirectors(env: Env, id: number): Promise<{ id: number; name: string }[]> {
  const res = await tmdb<{ crew?: { id: number; name: string; job?: string }[] }>(env, `/movie/${id}/credits`, 7 * 24 * 3600);
  return (res.crew ?? []).filter((m) => m.job === "Director").map((m) => ({ id: m.id, name: m.name }));
}

export async function topCast(env: Env, type: "tv" | "movie", id: number, limit = 8): Promise<CastMember[]> {
  const res = await tmdb<{ cast: CastMember[] }>(env, `/${type}/${id}/${type === "tv" ? "aggregate_credits" : "credits"}`, 7 * 24 * 3600);
  return (res.cast ?? []).slice(0, limit).map((m) => ({
    id: m.id,
    name: m.name,
    character: (m as { roles?: { character: string }[] }).roles?.[0]?.character ?? m.character ?? null,
    profile_path: m.profile_path,
  }));
}
