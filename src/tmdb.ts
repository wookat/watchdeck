import type { Env } from "./types";

const BASE = "https://api.themoviedb.org/3";
export const IMG = "https://image.tmdb.org/t/p";

async function tmdb<T>(env: Env, path: string, ttl = 6 * 3600): Promise<T> {
  const cacheKey = `tmdb:${path}`;
  const cached = await env.CACHE.get(cacheKey, "json");
  if (cached) return cached as T;
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${env.TMDB_READ_TOKEN}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${path}`);
  const data = (await res.json()) as T;
  await env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: ttl });
  return data;
}

export interface SearchResult {
  id: number;
  media_type?: string;
  name?: string;
  title?: string;
  poster_path: string | null;
  first_air_date?: string;
  release_date?: string;
  overview?: string;
  vote_average?: number;
}

export function searchMulti(env: Env, query: string) {
  return tmdb<{ results: SearchResult[] }>(env, `/search/multi?query=${encodeURIComponent(query)}&include_adult=false`);
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
  genres: { id: number; name: string }[];
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: { season_number: number; episode_count: number; name: string; poster_path: string | null; air_date: string | null }[];
  next_episode_to_air: { season_number: number; episode_number: number; air_date: string; name: string } | null;
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

export function discoverByGenre(env: Env, type: "tv" | "movie", genreId: number, page = 1) {
  return tmdb<{ results: SearchResult[]; total_pages: number }>(
    env,
    `/discover/${type}?with_genres=${genreId}&sort_by=popularity.desc&page=${Math.min(Math.max(page, 1), 20)}`,
    24 * 3600
  );
}

export interface WatchProviders {
  link: string;
  flatrate?: { provider_id: number; provider_name: string; logo_path: string }[];
}

export async function watchProviders(env: Env, type: "tv" | "movie", id: number, region = "US"): Promise<WatchProviders | null> {
  const res = await tmdb<{ results: Record<string, WatchProviders | undefined> }>(env, `/${type}/${id}/watch/providers`, 24 * 3600);
  return res.results[region] ?? null;
}

export function recommendations(env: Env, type: "tv" | "movie", id: number) {
  return tmdb<{ results: SearchResult[] }>(env, `/${type}/${id}/recommendations`, 24 * 3600);
}

export function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "title";
}

export function poster(path: string | null, size = "w342"): string {
  return path ? `${IMG}/${size}${path}` : "/placeholder-poster.svg";
}
