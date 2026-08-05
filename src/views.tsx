import type { FC, PropsWithChildren } from "hono/jsx";
import type { User } from "./types";
import { poster, slugify, type SearchResult, type TvDetails, type MovieDetails, type SeasonDetails } from "./tmdb";

export const Layout: FC<PropsWithChildren<{ user: User | null; title?: string; description?: string; canonical?: string }>> = ({
  children,
  user,
  title,
  description,
  canonical,
}) => (
  <html lang="en" class="dark">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title ? `${title} — WatchDeck` : "WatchDeck — Track your TV shows & movies on the web"}</title>
      <meta
        name="description"
        content={description ?? "WatchDeck is a free web-first TV show and movie tracker. Import your TV Time export in one click and pick up right where you left off."}
      />
      {canonical && <link rel="canonical" href={canonical} />}
      <link rel="stylesheet" href="/styles.css" />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    </head>
    <body class="min-h-screen bg-slate-950 text-slate-100 antialiased">
      <nav class="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 px-4 py-3">
          <a href={user ? "/home" : "/"} class="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span class="inline-block h-6 w-6 rounded bg-gradient-to-br from-violet-500 to-fuchsia-500" />
            WatchDeck
          </a>
          <form action="/search" method="get" class="ml-2 hidden flex-1 sm:block">
            <input
              type="search"
              name="q"
              placeholder="Search shows & movies…"
              class="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm placeholder-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </form>
          <div class="ml-auto flex items-center gap-2 text-sm sm:gap-3">
            <a href="/search" class="sm:hidden" aria-label="Search">🔍</a>
            <a href="/browse" class="px-1 py-2 hover:text-violet-400">Browse</a>
            {user ? (
              <>
                <a href="/home" class="px-1 py-2 hover:text-violet-400">Next Up</a>
                <a href="/library" class="px-1 py-2 hover:text-violet-400">Library</a>
                <a href="/calendar" class="px-1 py-2 hover:text-violet-400">Calendar</a>
                <a href="/import" class="px-1 py-2 hover:text-violet-400">Import</a>
                <a href="/stats" class="px-1 py-2 hover:text-violet-400">Stats</a>
                <form action="/logout" method="post" class="inline">
                  <button class="px-1 py-2 text-slate-400 hover:text-slate-200">Log out</button>
                </form>
              </>
            ) : (
              <>
                <a href="/login" class="hover:text-violet-400">Log in</a>
                <a href="/signup" class="rounded-lg bg-violet-600 px-3 py-1.5 font-medium text-white hover:bg-violet-500">
                  Join free
                </a>
              </>
            )}
          </div>
        </div>
      </nav>
      <main class="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer class="mt-16 border-t border-slate-800 py-8 text-sm text-slate-400">
        <div class="mx-auto max-w-6xl space-y-3 px-4">
          <p>
            WatchDeck — free, web-first TV & movie tracking. <a href="/import" class="text-violet-400 hover:underline">Import from TV Time</a>.
          </p>
          <p>
            Data by{" "}
            <a href="https://www.themoviedb.org/" rel="noopener" class="text-violet-400 hover:underline">
              TMDB
            </a>
            . This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
          <p>
            More from us:{" "}
            <a href="https://astrosage.zalize.com" class="hover:underline">AstroSage</a> ·{" "}
            <a href="https://subsleuth.zalize.com" class="hover:underline">SubSleuth</a> ·{" "}
            <a href="https://cv.zalize.com" class="hover:underline">CV</a>
          </p>
        </div>
      </footer>
    </body>
  </html>
);

export const Landing: FC<{ subscribed?: boolean }> = ({ subscribed }) => (
  <div>
    <section class="py-14 text-center">
      <p class="mb-3 inline-block rounded-full border border-violet-700 bg-violet-950/60 px-3 py-1 text-xs text-violet-300">
        TV Time shut down July 15 — your data still has a home
      </p>
      <h1 class="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
        Drop in your TV Time export.
        <br />
        <span class="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
          Be back on your next episode in 30 seconds.
        </span>
      </h1>
      <p class="mx-auto mt-4 max-w-xl text-slate-400">
        WatchDeck is a free, web-first tracker for TV shows <em>and</em> movies. One-click import of your TV Time GDPR
        export — episodes, follows and movies included. No app required.
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <a href="/signup" class="rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-500">
          Import my TV Time data
        </a>
        <a href="/browse" class="rounded-xl border border-slate-700 px-6 py-3 font-semibold hover:border-slate-500">
          Browse shows
        </a>
      </div>
    </section>
    <section class="grid gap-6 py-10 sm:grid-cols-3">
      {[
        ["📦 One-click TV Time import", "Upload the GDPR ZIP as-is. We match shows, episodes and movies — nothing left behind."],
        ["▶️ Next-episode first", "Your home screen is simply what to watch next. No feeds, no noise, no paywall."],
        ["🗓️ Never miss an airing", "A clean calendar of upcoming episodes for everything you track."],
      ].map(([h, p]) => (
        <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h3 class="mb-2 font-semibold">{h}</h3>
          <p class="text-sm text-slate-400">{p}</p>
        </div>
      ))}
    </section>
    <section class="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center">
      <h3 class="font-semibold">Get product updates</h3>
      <p class="mt-1 text-sm text-slate-400">Leave your email and we'll let you know as WatchDeck grows.</p>
      {subscribed && (
        <p class="mt-3 rounded-lg border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-300">
          You're on the list — thanks! 💌
        </p>
      )}
      <form action="/api/waitlist" method="post" class="mt-4 flex gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          class="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
        />
        <button class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">Notify me</button>
      </form>
    </section>
  </div>
);

export const AuthForm: FC<{ mode: "login" | "signup"; error?: string }> = ({ mode, error }) => (
  <div class="mx-auto max-w-sm py-10">
    <h1 class="mb-6 text-2xl font-bold">{mode === "login" ? "Log in" : "Create your free account"}</h1>
    {error && <p class="mb-4 rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</p>}
    <form action={`/${mode}`} method="post" class="space-y-4">
      <input
        type="email"
        name="email"
        required
        placeholder="Email"
        class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 focus:border-violet-500 focus:outline-none"
      />
      <input
        type="password"
        name="password"
        required
        minlength={8}
        placeholder="Password (8+ characters)"
        class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 focus:border-violet-500 focus:outline-none"
      />
      <button class="w-full rounded-lg bg-violet-600 py-2.5 font-semibold text-white hover:bg-violet-500">
        {mode === "login" ? "Log in" : "Sign up"}
      </button>
    </form>
    <p class="mt-4 text-sm text-slate-400">
      {mode === "login" ? (
        <>No account? <a href="/signup" class="text-violet-400 hover:underline">Sign up free</a></>
      ) : (
        <>Already a member? <a href="/login" class="text-violet-400 hover:underline">Log in</a></>
      )}
    </p>
  </div>
);

export const MediaCard: FC<{ item: SearchResult; type: "tv" | "movie" }> = ({ item, type }) => {
  const title = item.name ?? item.title ?? "Untitled";
  const year = (item.first_air_date ?? item.release_date ?? "").slice(0, 4);
  const href = type === "tv" ? `/shows/${item.id}-${slugify(title)}` : `/movies/${item.id}-${slugify(title)}`;
  return (
    <a href={href} class="group">
      <img
        src={poster(item.poster_path)}
        alt={title}
        loading="lazy"
        class="aspect-[2/3] w-full rounded-xl border border-slate-800 object-cover transition group-hover:border-violet-600"
      />
      <p class="mt-2 line-clamp-1 text-sm font-medium group-hover:text-violet-400">{title}</p>
      <p class="text-xs text-slate-500">
        {year} {type === "tv" ? "· TV" : "· Movie"}
      </p>
    </a>
  );
};

export interface NextUpItem {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  season: number;
  episode: number;
  episodeName: string | null;
  airDate: string | null;
}

export const HomePage: FC<{ nextUp: NextUpItem[]; watchlistCount: number; hasAnything: boolean }> = ({ nextUp, watchlistCount, hasAnything }) => (
  <div>
    <h1 class="mb-6 text-2xl font-bold">Next up</h1>
    {nextUp.length === 0 ? (
      <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-10 text-center">
        {hasAnything ? (
          <p class="text-slate-400">You're all caught up! 🎉 Check the <a href="/calendar" class="text-violet-400 hover:underline">calendar</a> for what's coming.</p>
        ) : (
          <>
            <p class="text-lg font-semibold">Let's get your shows in here</p>
            <p class="mt-2 text-slate-400">
              <a href="/import" class="text-violet-400 hover:underline">Import your TV Time export</a> or{" "}
              <a href="/search" class="text-violet-400 hover:underline">search for a show</a> to start tracking.
            </p>
          </>
        )}
      </div>
    ) : (
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {nextUp.map((n) => (
          <div class="flex gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <a href={`/shows/${n.tmdbId}-${slugify(n.title)}`}>
              <img src={poster(n.posterPath, "w154")} alt={n.title} class="h-28 w-auto rounded-lg border border-slate-800 object-cover" />
            </a>
            <div class="min-w-0">
              <a href={`/shows/${n.tmdbId}-${slugify(n.title)}`} class="line-clamp-1 font-semibold hover:text-violet-400">{n.title}</a>
              <p class="mt-1 text-sm text-violet-300">
                S{String(n.season).padStart(2, "0")}E{String(n.episode).padStart(2, "0")}
                {n.episodeName ? ` · ${n.episodeName}` : ""}
              </p>
              {n.airDate && <p class="text-xs text-slate-500">aired {n.airDate}</p>}
              <form action="/api/watch" method="post" class="mt-2">
                <input type="hidden" name="tmdb_id" value={String(n.tmdbId)} />
                <input type="hidden" name="season" value={String(n.season)} />
                <input type="hidden" name="episode" value={String(n.episode)} />
                <input type="hidden" name="redirect" value="/home" />
                <button class="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500">
                  ✓ Watched
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    )}
    {watchlistCount > 0 && (
      <p class="mt-8 text-sm text-slate-400">
        You have {watchlistCount} title{watchlistCount === 1 ? "" : "s"} on your <a href="/library?status=watchlist" class="text-violet-400 hover:underline">watchlist</a>.
      </p>
    )}
  </div>
);

export const SearchPage: FC<{ q: string; results: SearchResult[] }> = ({ q, results }) => (
  <div>
    <form action="/search" method="get" class="mb-6">
      <input
        type="search"
        name="q"
        value={q}
        placeholder="Search shows & movies…"
        class="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 placeholder-slate-500 focus:border-violet-500 focus:outline-none"
      />
    </form>
    {q && <h1 class="mb-4 text-xl font-semibold">Results for “{q}”</h1>}
    <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {results
        .filter((r) => r.media_type === "tv" || r.media_type === "movie")
        .map((r) => (
          <MediaCard item={r} type={r.media_type as "tv" | "movie"} />
        ))}
    </div>
    {q && results.length === 0 && <p class="text-slate-400">Nothing found.</p>}
  </div>
);

export const TrendingSection: FC<{ shows: SearchResult[]; movies: SearchResult[] }> = ({ shows, movies }) => (
  <div class="space-y-10">
    <section>
      <h2 class="mb-4 text-xl font-semibold">Trending shows this week</h2>
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {shows.slice(0, 12).map((s) => (
          <MediaCard item={s} type="tv" />
        ))}
      </div>
    </section>
    <section>
      <h2 class="mb-4 text-xl font-semibold">Trending movies this week</h2>
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {movies.slice(0, 12).map((m) => (
          <MediaCard item={m} type="movie" />
        ))}
      </div>
    </section>
  </div>
);

export const ShowPage: FC<{
  show: TvDetails;
  season: SeasonDetails | null;
  watched: Set<string>;
  tracked: { status: string } | null;
  user: User | null;
}> = ({ show, season, watched, tracked, user }) => {
  const showUrl = `/shows/${show.id}-${slugify(show.name)}`;
  return (
    <div>
      <div class="flex flex-col gap-6 sm:flex-row">
        <img src={poster(show.poster_path)} alt={show.name} class="w-40 self-start rounded-xl border border-slate-800 sm:w-52" />
        <div class="min-w-0 flex-1">
          <h1 class="text-3xl font-bold">{show.name}</h1>
          <p class="mt-1 text-sm text-slate-400">
            {show.first_air_date?.slice(0, 4)} · {show.number_of_seasons} season{show.number_of_seasons === 1 ? "" : "s"} ·{" "}
            {show.number_of_episodes} episodes · {show.status} · ★ {show.vote_average?.toFixed(1)}
          </p>
          <p class="mt-1 text-sm text-slate-500">{show.genres.map((g) => g.name).join(", ")}</p>
          <p class="mt-4 max-w-2xl text-slate-300">{show.overview}</p>
          {user ? (
            <div class="mt-5 flex flex-wrap gap-2">
              {(["watching", "watchlist", "completed", "dropped"] as const).map((s) => (
                <form action="/api/track" method="post">
                  <input type="hidden" name="tmdb_id" value={String(show.id)} />
                  <input type="hidden" name="media_type" value="tv" />
                  <input type="hidden" name="status" value={s} />
                  <input type="hidden" name="redirect" value={showUrl} />
                  <button
                    class={
                      tracked?.status === s
                        ? "rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white"
                        : "rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:border-violet-500"
                    }
                  >
                    {s === "watching" ? "▶ Watching" : s === "watchlist" ? "+ Watchlist" : s === "completed" ? "✓ Completed" : "✕ Dropped"}
                  </button>
                </form>
              ))}
            </div>
          ) : (
            <p class="mt-5 text-sm text-slate-400">
              <a href="/signup" class="text-violet-400 hover:underline">Join free</a> to track this show.
            </p>
          )}
        </div>
      </div>

      <div class="mt-10">
        <div class="mb-4 flex flex-wrap gap-2">
          {show.seasons
            .filter((s) => s.season_number > 0)
            .map((s) => {
              const seen = [...watched].filter((k) => k.startsWith(`${s.season_number}x`)).length;
              return (
                <a
                  href={`${showUrl}?season=${s.season_number}`}
                  class={
                    season?.season_number === s.season_number
                      ? "rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white"
                      : "rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:border-violet-500"
                  }
                >
                  Season {s.season_number}
                  <span class={s.episode_count > 0 && seen >= s.episode_count ? "ml-1.5 text-xs text-emerald-300" : "ml-1.5 text-xs opacity-70"}>
                    {seen}/{s.episode_count}
                  </span>
                </a>
              );
            })}
        </div>
        {season && user && (
          <form action="/api/watch-season" method="post" class="mb-4">
            <input type="hidden" name="tmdb_id" value={String(show.id)} />
            <input type="hidden" name="season" value={String(season.season_number)} />
            <input type="hidden" name="redirect" value={`${showUrl}?season=${season.season_number}`} />
            <button class="rounded-lg border border-violet-700 bg-violet-950/50 px-3 py-1.5 text-sm text-violet-300 hover:bg-violet-900/50">
              ✓ Mark season {season.season_number} watched
            </button>
          </form>
        )}
        {season && (
          <ul class="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800">
            {season.episodes.map((ep) => {
              const isWatched = watched.has(`${ep.season_number}x${ep.episode_number}`);
              return (
                <li class="flex items-center gap-4 bg-slate-900/40 px-4 py-3">
                  <span class="w-14 shrink-0 text-sm text-slate-500">
                    S{String(ep.season_number).padStart(2, "0")}E{String(ep.episode_number).padStart(2, "0")}
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="line-clamp-1 font-medium">{ep.name}</p>
                    <p class="text-xs text-slate-500">{ep.air_date ?? "TBA"}</p>
                  </div>
                  {user && (
                    <form action="/api/watch" method="post">
                      <input type="hidden" name="tmdb_id" value={String(show.id)} />
                      <input type="hidden" name="season" value={String(ep.season_number)} />
                      <input type="hidden" name="episode" value={String(ep.episode_number)} />
                      <input type="hidden" name="undo" value={isWatched ? "1" : ""} />
                      <input type="hidden" name="redirect" value={`${showUrl}?season=${season.season_number}`} />
                      <button
                        class={
                          isWatched
                            ? "rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-600"
                            : "rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:border-violet-500"
                        }
                      >
                        {isWatched ? "✓ Watched" : "Mark watched"}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export const MoviePage: FC<{ movie: MovieDetails; watched: boolean; tracked: { status: string } | null; user: User | null }> = ({
  movie,
  watched,
  tracked,
  user,
}) => {
  const movieUrl = `/movies/${movie.id}-${slugify(movie.title)}`;
  return (
    <div class="flex flex-col gap-6 sm:flex-row">
      <img src={poster(movie.poster_path)} alt={movie.title} class="w-40 self-start rounded-xl border border-slate-800 sm:w-52" />
      <div class="min-w-0 flex-1">
        <h1 class="text-3xl font-bold">{movie.title}</h1>
        <p class="mt-1 text-sm text-slate-400">
          {movie.release_date?.slice(0, 4)} {movie.runtime ? `· ${movie.runtime} min` : ""} · ★ {movie.vote_average?.toFixed(1)}
        </p>
        <p class="mt-1 text-sm text-slate-500">{movie.genres.map((g) => g.name).join(", ")}</p>
        <p class="mt-4 max-w-2xl text-slate-300">{movie.overview}</p>
        {user ? (
          <div class="mt-5 flex flex-wrap gap-2">
            <form action="/api/watch-movie" method="post">
              <input type="hidden" name="tmdb_id" value={String(movie.id)} />
              <input type="hidden" name="undo" value={watched ? "1" : ""} />
              <input type="hidden" name="redirect" value={movieUrl} />
              <button
                class={
                  watched
                    ? "rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-600"
                    : "rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
                }
              >
                {watched ? "✓ Watched" : "Mark watched"}
              </button>
            </form>
            <form action="/api/track" method="post">
              <input type="hidden" name="tmdb_id" value={String(movie.id)} />
              <input type="hidden" name="media_type" value="movie" />
              <input type="hidden" name="status" value="watchlist" />
              <input type="hidden" name="redirect" value={movieUrl} />
              <button
                class={
                  tracked?.status === "watchlist"
                    ? "rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white"
                    : "rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:border-violet-500"
                }
              >
                + Watchlist
              </button>
            </form>
          </div>
        ) : (
          <p class="mt-5 text-sm text-slate-400">
            <a href="/signup" class="text-violet-400 hover:underline">Join free</a> to track this movie.
          </p>
        )}
      </div>
    </div>
  );
};

export interface LibraryRow {
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string;
  poster_path: string | null;
  status: string;
  eps_watched: number;
}

export const LibraryPage: FC<{ rows: LibraryRow[]; status: string }> = ({ rows, status }) => (
  <div>
    <h1 class="mb-4 text-2xl font-bold">Library</h1>
    <div class="mb-6 flex flex-wrap gap-2">
      {["all", "watching", "watchlist", "completed", "dropped"].map((s) => (
        <a
          href={s === "all" ? "/library" : `/library?status=${s}`}
          class={
            status === s
              ? "rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white"
              : "rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:border-violet-500"
          }
        >
          {s[0].toUpperCase() + s.slice(1)}
        </a>
      ))}
    </div>
    {rows.length === 0 ? (
      <p class="text-slate-400">
        Nothing here yet. <a href="/import" class="text-violet-400 hover:underline">Import from TV Time</a> or{" "}
        <a href="/search" class="text-violet-400 hover:underline">search</a>.
      </p>
    ) : (
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {rows.map((r) => (
          <a href={`/${r.media_type === "tv" ? "shows" : "movies"}/${r.tmdb_id}-${slugify(r.title)}`} class="group">
            <img
              src={poster(r.poster_path)}
              alt={r.title}
              loading="lazy"
              class="aspect-[2/3] w-full rounded-xl border border-slate-800 object-cover transition group-hover:border-violet-600"
            />
            <p class="mt-2 line-clamp-1 text-sm font-medium group-hover:text-violet-400">{r.title}</p>
            <p class="text-xs text-slate-500">
              {r.status}
              {r.media_type === "tv" && r.eps_watched > 0 ? ` · ${r.eps_watched} ep${r.eps_watched === 1 ? "" : "s"} watched` : ""}
            </p>
          </a>
        ))}
      </div>
    )}
  </div>
);

export interface CalendarItem {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  season: number;
  episode: number;
  episodeName: string;
  airDate: string;
}

export const CalendarPage: FC<{ items: CalendarItem[]; feedUrl: string }> = ({ items, feedUrl }) => (
  <div>
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <h1 class="text-2xl font-bold">Upcoming episodes</h1>
      <a href={feedUrl} class="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-violet-300 hover:border-violet-500">
        📅 Subscribe (iCal)
      </a>
    </div>
    {items.length === 0 ? (
      <p class="text-slate-400">No upcoming episodes for the shows you track — try adding more from <a href="/search" class="text-violet-400 hover:underline">search</a>.</p>
    ) : (
      <ul class="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800">
        {items.map((it) => (
          <li class="flex items-center gap-4 bg-slate-900/40 px-4 py-3">
            <span class="w-24 shrink-0 text-sm text-violet-300">{it.airDate}</span>
            <img src={poster(it.posterPath, "w92")} alt="" class="h-14 w-auto rounded border border-slate-800" />
            <div class="min-w-0">
              <a href={`/shows/${it.tmdbId}-${slugify(it.title)}`} class="line-clamp-1 font-medium hover:text-violet-400">
                {it.title}
              </a>
              <p class="text-sm text-slate-500">
                S{String(it.season).padStart(2, "0")}E{String(it.episode).padStart(2, "0")} · {it.episodeName}
              </p>
            </div>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export const BrowseIndex: FC<{ tvGenres: { id: number; name: string }[]; movieGenres: { id: number; name: string }[] }> = ({
  tvGenres,
  movieGenres,
}) => (
  <div>
    <h1 class="mb-2 text-2xl font-bold">Browse by genre</h1>
    <p class="mb-8 text-slate-400">Find your next watch across every genre — powered by TMDB.</p>
    {(
      [
        ["TV shows", "tv", tvGenres],
        ["Movies", "movie", movieGenres],
      ] as const
    ).map(([label, type, genres]) => (
      <section class="mb-10">
        <h2 class="mb-4 text-xl font-semibold">{label}</h2>
        <div class="flex flex-wrap gap-2">
          {genres.map((g) => (
            <a
              href={`/browse/${type}/${g.id}-${slugify(g.name)}`}
              class="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:border-violet-500 hover:text-violet-300"
            >
              {g.name}
            </a>
          ))}
        </div>
      </section>
    ))}
  </div>
);

export const BrowseGenre: FC<{
  type: "tv" | "movie";
  genre: { id: number; name: string };
  results: SearchResult[];
  page: number;
  totalPages: number;
}> = ({ type, genre, results, page, totalPages }) => {
  const base = `/browse/${type}/${genre.id}-${slugify(genre.name)}`;
  return (
    <div>
      <h1 class="mb-2 text-2xl font-bold">
        {genre.name} {type === "tv" ? "TV shows" : "movies"}
      </h1>
      <p class="mb-6 text-slate-400">
        Popular {genre.name.toLowerCase()} {type === "tv" ? "series" : "films"} to track on WatchDeck.{" "}
        <a href="/browse" class="text-violet-400 hover:underline">All genres</a>
      </p>
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {results.map((r) => (
          <MediaCard item={r} type={type} />
        ))}
      </div>
      <div class="mt-8 flex items-center gap-3 text-sm">
        {page > 1 && <a href={`${base}?page=${page - 1}`} class="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-violet-500">← Previous</a>}
        <span class="text-slate-500">Page {page} of {Math.min(totalPages, 20)}</span>
        {page < Math.min(totalPages, 20) && <a href={`${base}?page=${page + 1}`} class="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-violet-500">Next →</a>}
      </div>
    </div>
  );
};

export interface UserStats {
  epsWatched: number;
  moviesWatched: number;
  showsTracked: number;
  completedShows: number;
  topShows: { title: string; tmdb_id: number; eps: number }[];
  byMonth: { month: string; eps: number }[];
}

export const StatsPage: FC<{ stats: UserStats }> = ({ stats }) => {
  const maxMonth = Math.max(1, ...stats.byMonth.map((m) => m.eps));
  return (
    <div>
      <h1 class="mb-6 text-2xl font-bold">Your watch stats</h1>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          [String(stats.epsWatched), "episodes watched"],
          [String(stats.moviesWatched), "movies watched"],
          [String(stats.showsTracked), "shows tracked"],
          [String(stats.completedShows), "shows completed"],
        ].map(([n, label]) => (
          <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-center">
            <p class="text-3xl font-extrabold text-violet-300">{n}</p>
            <p class="mt-1 text-sm text-slate-400">{label}</p>
          </div>
        ))}
      </div>
      <div class="mt-8 grid gap-6 md:grid-cols-2">
        <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 class="mb-4 font-semibold">Most-watched shows</h2>
          {stats.topShows.length === 0 ? (
            <p class="text-sm text-slate-400">No episodes tracked yet.</p>
          ) : (
            <ol class="space-y-2">
              {stats.topShows.map((s, i) => (
                <li class="flex items-center gap-3 text-sm">
                  <span class="w-5 text-slate-500">{i + 1}.</span>
                  <a href={`/shows/${s.tmdb_id}-${slugify(s.title)}`} class="flex-1 truncate hover:text-violet-400">{s.title}</a>
                  <span class="text-slate-400">{s.eps} eps</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 class="mb-4 font-semibold">Episodes per month (last 12)</h2>
          {stats.byMonth.length === 0 ? (
            <p class="text-sm text-slate-400">Nothing yet — go watch something!</p>
          ) : (
            <ul class="space-y-1.5">
              {stats.byMonth.map((m) => (
                <li class="flex items-center gap-2 text-xs">
                  <span class="w-16 shrink-0 text-slate-500">{m.month}</span>
                  <div class="h-3 rounded bg-gradient-to-r from-violet-600 to-fuchsia-500" style={`width:${Math.max(2, Math.round((m.eps / maxMonth) * 100))}%`} />
                  <span class="text-slate-400">{m.eps}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export const ImportPage: FC = () => (
  <div class="mx-auto max-w-2xl">
    <h1 class="text-2xl font-bold">Import from TV Time</h1>
    <p class="mt-2 text-slate-400">
      Upload the ZIP you got from{" "}
      <a href="https://gdpr.tvtime.com/gdpr/self-service" rel="noopener" class="text-violet-400 hover:underline">
        gdpr.tvtime.com
      </a>
      . We import your tracked episodes, followed shows <strong>and movies</strong> — then take you straight to your next episode.
    </p>
    <div
      id="dropzone"
      class="mt-6 cursor-pointer rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 p-10 text-center transition hover:border-violet-500"
    >
      <p class="text-lg">📦 Drag & drop your TV Time ZIP here</p>
      <p class="mt-1 text-sm text-slate-500">or click to choose the file</p>
      <input id="zipfile" type="file" accept=".zip" class="hidden" />
    </div>
    <div id="progress" class="mt-6 hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
      <p id="progress-text" class="font-medium">Parsing your export…</p>
      <div class="mt-3 h-2 overflow-hidden rounded bg-slate-800">
        <div id="progress-bar" class="h-full w-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all" />
      </div>
      <p id="progress-detail" class="mt-2 text-sm text-slate-400"></p>
    </div>
    <div id="done" class="mt-6 hidden rounded-2xl border border-emerald-800 bg-emerald-950/40 p-6">
      <p class="font-semibold text-emerald-300">Import complete 🎉</p>
      <p id="done-detail" class="mt-1 text-sm text-slate-300"></p>
      <div id="unmatched" class="mt-3 hidden">
        <p class="text-sm font-medium text-amber-300">We couldn't match these titles — find them manually:</p>
        <ul id="unmatched-list" class="mt-2 space-y-1 text-sm"></ul>
      </div>
      <a href="/home" class="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500">
        Show me my next episode →
      </a>
    </div>
    <script src="/import.js" />
  </div>
);
