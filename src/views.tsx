import type { FC, PropsWithChildren } from "hono/jsx";
import type { User } from "./types";
import { poster, slugify, type SearchResult, type TvDetails, type MovieDetails, type SeasonDetails } from "./tmdb";

export const Layout: FC<PropsWithChildren<{ user: User | null; title?: string; description?: string; canonical?: string; ogImage?: string }>> = ({
  children,
  user,
  title,
  description,
  canonical,
  ogImage,
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
      <meta property="og:title" content={title ? `${title} — WatchDeck` : "WatchDeck — Track your TV shows & movies on the web"} />
      {description && <meta property="og:description" content={description} />}
      {canonical && <meta property="og:url" content={canonical} />}
      {ogImage && <meta property="og:image" content={ogImage} />}
      {ogImage && <meta name="twitter:card" content="summary_large_image" />}
      <link rel="stylesheet" href="/styles.css" />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    </head>
    <body class="min-h-screen bg-slate-950 text-slate-100 antialiased">
      <a
        href="#main"
        class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-violet-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
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
              aria-label="Search shows and movies"
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
      <main id="main" class="mx-auto max-w-6xl px-4 py-6">{children}</main>
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
        <>No account? <a href="/signup" class="text-violet-400 hover:underline">Sign up free</a> · <a href="/forgot" class="text-violet-400 hover:underline">Forgot password?</a></>
      ) : (
        <>Already a member? <a href="/login" class="text-violet-400 hover:underline">Log in</a></>
      )}
    </p>
  </div>
);

export const ForgotForm: FC<{ sent?: boolean; error?: string }> = ({ sent, error }) => (
  <div class="mx-auto max-w-sm py-10">
    <h1 class="mb-6 text-2xl font-bold">Reset your password</h1>
    {sent ? (
      <p class="rounded-lg border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-300">
        If that email is registered, a reset link is on its way. Check your inbox (and spam).
      </p>
    ) : (
      <>
        {error && <p class="mb-4 rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</p>}
        <form action="/forgot" method="post" class="space-y-4">
          <input
            type="email"
            name="email"
            required
            placeholder="Email"
            class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 focus:border-violet-500 focus:outline-none"
          />
          <button class="w-full rounded-lg bg-violet-600 py-2.5 font-semibold text-white hover:bg-violet-500">Send reset link</button>
        </form>
      </>
    )}
    <p class="mt-4 text-sm text-slate-400">
      <a href="/login" class="text-violet-400 hover:underline">Back to log in</a>
    </p>
  </div>
);

export const ResetForm: FC<{ token: string; error?: string }> = ({ token, error }) => (
  <div class="mx-auto max-w-sm py-10">
    <h1 class="mb-6 text-2xl font-bold">Choose a new password</h1>
    {error && <p class="mb-4 rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</p>}
    <form action={`/reset/${token}`} method="post" class="space-y-4">
      <input
        type="password"
        name="password"
        required
        minlength={8}
        placeholder="New password (8+ characters)"
        class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 focus:border-violet-500 focus:outline-none"
      />
      <button class="w-full rounded-lg bg-violet-600 py-2.5 font-semibold text-white hover:bg-violet-500">Set new password</button>
    </form>
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
        {year ? `${year} · ` : ""}{type === "tv" ? "TV" : "Movie"}
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

export const HomePage: FC<{ nextUp: NextUpItem[]; watchlistCount: number; hasAnything: boolean; justWatched?: { tmdbId: number; season: number; episode: number } | null }> = ({ nextUp, watchlistCount, hasAnything, justWatched }) => (
  <div>
    <h1 class="mb-6 text-2xl font-bold">Next up</h1>
    {justWatched && (
      <div class="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-800 bg-emerald-950/40 px-4 py-2.5 text-sm text-emerald-300">
        <span>
          Marked S{String(justWatched.season).padStart(2, "0")}E{String(justWatched.episode).padStart(2, "0")} watched.
        </span>
        <form action="/api/watch" method="post">
          <input type="hidden" name="tmdb_id" value={String(justWatched.tmdbId)} />
          <input type="hidden" name="season" value={String(justWatched.season)} />
          <input type="hidden" name="episode" value={String(justWatched.episode)} />
          <input type="hidden" name="undo" value="1" />
          <input type="hidden" name="redirect" value="/home" />
          <button class="font-medium text-emerald-200 underline hover:text-white">Undo</button>
        </form>
      </div>
    )}
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
                <input type="hidden" name="redirect" value={`/home?w=${n.tmdbId}.${n.season}.${n.episode}`} />
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

export const RecsSection: FC<{ recs: SearchResult[]; type: "tv" | "movie" }> = ({ recs, type }) =>
  recs.length === 0 ? null : (
    <div class="mt-12">
      <h2 class="mb-4 text-xl font-semibold">More like this</h2>
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {recs.slice(0, 12).map((r) => (
          <MediaCard item={r} type={type} />
        ))}
      </div>
    </div>
  );

export const RatingStars: FC<{ tmdbId: number; mediaType: "tv" | "movie"; title: string; posterPath: string | null; rating: number | null; redirect: string }> = ({
  tmdbId,
  mediaType,
  title,
  posterPath,
  rating,
  redirect,
}) => (
  <div class="mt-3 flex items-center gap-1" aria-label="Your rating">
    <span class="mr-1 text-sm text-slate-400">Your rating:</span>
    {[1, 2, 3, 4, 5].map((n) => (
      <form action="/api/rate" method="post">
        <input type="hidden" name="tmdb_id" value={String(tmdbId)} />
        <input type="hidden" name="media_type" value={mediaType} />
        <input type="hidden" name="title" value={title} />
        <input type="hidden" name="poster_path" value={posterPath ?? ""} />
        <input type="hidden" name="rating" value={String(rating === n ? 0 : n)} />
        <input type="hidden" name="redirect" value={redirect} />
        <button
          class={(rating ?? 0) >= n ? "text-xl text-amber-400 transition-colors hover:scale-110" : "text-xl text-slate-600 transition-colors hover:text-amber-300"}
          title={rating === n ? "Clear rating" : `Rate ${n} star${n === 1 ? "" : "s"}`}
          aria-label={rating === n ? "Clear rating" : `Rate ${n} star${n === 1 ? "" : "s"}`}
          aria-pressed={(rating ?? 0) >= n ? "true" : "false"}
        >
          ★
        </button>
      </form>
    ))}
  </div>
);

export const ShowPage: FC<{
  show: TvDetails;
  season: SeasonDetails | null;
  watched: Set<string>;
  tracked: { status: string; rating: number | null } | null;
  user: User | null;
  recs: SearchResult[];
}> = ({ show, season, watched, tracked, user, recs }) => {
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
          {user && (
            <RatingStars tmdbId={show.id} mediaType="tv" title={show.name} posterPath={show.poster_path} rating={tracked?.rating ?? null} redirect={showUrl} />
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
        {season && user && (() => {
          const today = new Date().toISOString().slice(0, 10);
          const aired = season.episodes.filter((ep) => ep.air_date && ep.air_date <= today);
          const allWatched = aired.length > 0 && aired.every((ep) => watched.has(`${ep.season_number}x${ep.episode_number}`));
          return (
            <form action="/api/watch-season" method="post" class="mb-4">
              <input type="hidden" name="tmdb_id" value={String(show.id)} />
              <input type="hidden" name="season" value={String(season.season_number)} />
              <input type="hidden" name="undo" value={allWatched ? "1" : ""} />
              <input type="hidden" name="redirect" value={`${showUrl}?season=${season.season_number}`} />
              <button
                class={
                  allWatched
                    ? "rounded-lg border border-emerald-800 bg-emerald-950/50 px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-900/50"
                    : "rounded-lg border border-violet-700 bg-violet-950/50 px-3 py-1.5 text-sm text-violet-300 hover:bg-violet-900/50"
                }
              >
                {allWatched ? `✓ Season ${season.season_number} watched — unmark all` : `✓ Mark season ${season.season_number} watched`}
              </button>
            </form>
          );
        })()}
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
      <RecsSection recs={recs} type="tv" />
    </div>
  );
};

export const MoviePage: FC<{
  movie: MovieDetails;
  watched: boolean;
  tracked: { status: string; rating: number | null } | null;
  user: User | null;
  recs: SearchResult[];
}> = ({ movie, watched, tracked, user, recs }) => {
  const movieUrl = `/movies/${movie.id}-${slugify(movie.title)}`;
  return (
    <div>
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
        {user && (
          <RatingStars tmdbId={movie.id} mediaType="movie" title={movie.title} posterPath={movie.poster_path} rating={tracked?.rating ?? null} redirect={movieUrl} />
        )}
      </div>
    </div>
    <RecsSection recs={recs} type="movie" />
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
  rating: number | null;
}

export const LibraryPage: FC<{ rows: LibraryRow[]; status: string; sort: string; q?: string }> = ({ rows, status, sort, q }) => (
  <div>
    <h1 class="mb-4 text-2xl font-bold">Library</h1>
    <form action="/library" method="get" class="mb-3 max-w-xs">
      {status !== "all" && <input type="hidden" name="status" value={status} />}
      <input type="hidden" name="sort" value={sort} />
      <input
        type="search"
        name="q"
        value={q ?? ""}
        placeholder="Filter your library…"
        aria-label="Filter your library by title"
        class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm placeholder-slate-500 focus:border-violet-500 focus:outline-none"
      />
    </form>
    <div class="mb-3 flex flex-wrap gap-2">
      {["all", "watching", "watchlist", "completed", "dropped"].map((s) => (
        <a
          href={`/library?${s === "all" ? "" : `status=${s}&`}sort=${sort}`}
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
    <div class="mb-6 flex flex-wrap items-center gap-2 text-sm">
      <span class="text-slate-500">Sort:</span>
      {(
        [
          ["recent", "Recently updated"],
          ["title", "Title A\u2013Z"],
          ["progress", "Most watched"],
        ] as const
      ).map(([key, label]) => (
        <a
          href={`/library?${status === "all" ? "" : `status=${status}&`}sort=${key}`}
          class={sort === key ? "rounded-lg bg-slate-700 px-2.5 py-1 text-white" : "rounded-lg px-2.5 py-1 text-slate-400 hover:text-slate-200"}
        >
          {label}
        </a>
      ))}
    </div>
    {rows.length === 0 ? (
      q ? (
        <p class="text-slate-400">
          Nothing in your library matches “{q}”. <a href={`/library?${status === "all" ? "" : `status=${status}&`}sort=${sort}`} class="text-violet-400 hover:underline">Clear filter</a>
        </p>
      ) : (
      <p class="text-slate-400">
        Nothing here yet. <a href="/import" class="text-violet-400 hover:underline">Import from TV Time</a> or{" "}
        <a href="/search" class="text-violet-400 hover:underline">search</a>.
      </p>
      )
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
              {r.rating ? <span class="text-amber-400"> · ★ {r.rating}</span> : ""}
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

export const CalendarPage: FC<{ items: CalendarItem[]; feedUrl: string; remindEmail: boolean }> = ({ items, feedUrl, remindEmail }) => (
  <div>
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <h1 class="text-2xl font-bold">Upcoming episodes</h1>
      <a href={feedUrl} class="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-violet-300 hover:border-violet-500">
        📅 Subscribe (iCal)
      </a>
      <form action="/api/reminders" method="post">
        <input type="hidden" name="enabled" value={remindEmail ? "" : "1"} />
        <button
          class={
            remindEmail
              ? "rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-600"
              : "rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:border-violet-500"
          }
        >
          {remindEmail ? "✉️ Email reminders on" : "✉️ Email me on air dates"}
        </button>
      </form>
    </div>
    {items.length === 0 ? (
      <p class="text-slate-400">
        No scheduled air dates right now — the shows you track have no announced upcoming episodes. New dates show up here (and in your iCal feed) automatically. Looking for something new? <a href="/browse" class="text-violet-400 hover:underline">Browse by genre</a>.
      </p>
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
  hoursWatched: number;
  epsWatched: number;
  moviesWatched: number;
  showsTracked: number;
  completedShows: number;
  topShows: { title: string; tmdb_id: number; eps: number }[];
  byMonth: { month: string; eps: number }[];
}

const StatsBody: FC<{ stats: UserStats }> = ({ stats }) => {
  const maxMonth = Math.max(1, ...stats.byMonth.map((m) => m.eps));
  return (
    <div>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          [stats.hoursWatched.toLocaleString("en-US"), "hours watched"],
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
          {stats.topShows.length > 0 && stats.topShows.length < stats.showsTracked && (
            <p class="mt-3 text-xs text-slate-500">Your other tracked shows appear here once you log episodes for them.</p>
          )}
        </div>
        <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 class="mb-4 font-semibold">Episodes per month (last 12)</h2>
          {stats.byMonth.length === 0 ? (
            <p class="text-sm text-slate-400">No episodes watched in the last 12 months.</p>
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

export const StatsPage: FC<{ stats: UserStats; shareUrl: string | null }> = ({ stats, shareUrl }) => (
  <div>
    <h1 class="mb-6 text-2xl font-bold">Your watch stats</h1>
    <StatsBody stats={stats} />
    <div class="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
      <h2 class="font-semibold">Share your profile</h2>
      {shareUrl ? (
        <div class="mt-3">
          <p class="text-sm text-slate-400">Anyone with this link can see a read-only copy of this page (no email shown):</p>
          <p class="mt-2 break-all rounded-lg bg-slate-800/70 px-3 py-2 font-mono text-sm text-violet-300">{shareUrl}</p>
          <form action="/api/share" method="post" class="mt-3">
            <input type="hidden" name="enabled" value="" />
            <button class="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-red-500 hover:text-red-400">Disable share link</button>
          </form>
        </div>
      ) : (
        <div class="mt-3">
          <p class="text-sm text-slate-400">Create a public read-only link to your stats — great for a year-in-review post.</p>
          <form action="/api/share" method="post" class="mt-3">
            <input type="hidden" name="enabled" value="1" />
            <button class="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Create share link</button>
          </form>
        </div>
      )}
    </div>
  </div>
);

export const PublicProfilePage: FC<{ stats: UserStats; name: string }> = ({ stats, name }) => (
  <div>
    <h1 class="mb-1 text-2xl font-bold">{name}'s watch stats</h1>
    <p class="mb-6 text-sm text-slate-400">
      Shared from <a href="/" class="text-violet-400 hover:underline">WatchDeck</a> — track your shows &amp; movies on the web.
    </p>
    <StatsBody stats={stats} />
    <div class="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center">
      <p class="text-slate-300">Want stats like these?</p>
      <a href="/signup" class="mt-3 inline-block rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">Start tracking free</a>
    </div>
  </div>
);

export const ImportPage: FC = () => (
  <div class="mx-auto max-w-2xl">
    <h1 class="text-2xl font-bold">Import from TV Time</h1>
    <p class="mt-2 text-slate-400">
      Upload the ZIP you got from{" "}
      <a href="https://gdpr.tvtime.com/gdpr/self-service" rel="noopener" class="text-violet-400 hover:underline">
        gdpr.tvtime.com
      </a>
      . We import your tracked episodes, followed shows <strong>and movies</strong> — then take you straight to your next episode. Coming
      from Trakt or Serializd? A CSV export with a title column works too.
    </p>
    <div
      id="dropzone"
      class="mt-6 cursor-pointer rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 p-10 text-center transition hover:border-violet-500"
    >
      <p class="text-lg">📦 Drag & drop your TV Time ZIP (or CSV) here</p>
      <p class="mt-1 text-sm text-slate-500">or click to choose the file</p>
      <input id="zipfile" type="file" accept=".zip,.csv" class="hidden" />
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
