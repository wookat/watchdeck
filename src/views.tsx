import type { FC, PropsWithChildren } from "hono/jsx";
import type { User } from "./types";
import { poster, slugify, type SearchResult, type TvDetails, type MovieDetails, type SeasonDetails, type WatchProviders, type CastMember } from "./tmdb";

export const Layout: FC<PropsWithChildren<{ user: User | null; title?: string; description?: string; canonical?: string; ogImage?: string; jsonLd?: object; prev?: string; next?: string }>> = ({
  children,
  user,
  title,
  description,
  canonical,
  ogImage,
  jsonLd,
  prev,
  next,
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
      {prev && <link rel="prev" href={prev} />}
      {next && <link rel="next" href={next} />}
      <meta property="og:title" content={title ? `${title} — WatchDeck` : "WatchDeck — Track your TV shows & movies on the web"} />
      {description && <meta property="og:description" content={description} />}
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:site_name" content="WatchDeck" />
      <meta property="og:image" content={ogImage ?? "https://watchdeck.zalize.com/og-default.png"} />
      <meta name="twitter:card" content="summary_large_image" />
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <link rel="stylesheet" href="/styles.css" />
      <script src="/app.js" defer></script>
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <link rel="manifest" href="/manifest.webmanifest" />
      <meta name="theme-color" content="#020617" />
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
              title="Press / to search"
              class="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm placeholder-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </form>
          <div class="ml-auto flex items-center gap-2 text-sm sm:gap-3 whitespace-nowrap max-sm:w-full max-sm:overflow-x-auto max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
            <a href="/search" class="sm:hidden" aria-label="Search">🔍</a>
            <a href="/browse" class="px-1 py-2 hover:text-violet-400">Browse</a>
            {user ? (
              <>
                <a href="/home" class="px-1 py-2 hover:text-violet-400">Next Up</a>
                <a href="/library" class="px-1 py-2 hover:text-violet-400">Library</a>
                <a href="/calendar" class="px-1 py-2 hover:text-violet-400">Calendar</a>
                <a href="/import" class="px-1 py-2 hover:text-violet-400">Import</a>
                <a href="/history" class="px-1 py-2 hover:text-violet-400">History</a>
                <a href="/stats" class="px-1 py-2 hover:text-violet-400">Stats</a>
                <a href="/settings" class="px-1 py-2 hover:text-violet-400" aria-label="Settings">⚙</a>
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
            <a href="/privacy" class="hover:underline">Privacy</a> · <a href="/terms" class="hover:underline">Terms</a>
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
    <section class="py-12">
      <h2 class="mb-6 text-center text-2xl font-bold">Frequently asked questions</h2>
      <div class="mx-auto max-w-2xl space-y-3">
        {landingFaqs.map(([q, a]) => (
          <details class="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <summary class="cursor-pointer font-medium">{q}</summary>
            <p class="mt-2 text-sm text-slate-400">{a}</p>
          </details>
        ))}
      </div>
    </section>
  </div>
);

export const landingFaqs: [string, string][] = [
  [
    "How do I import my TV Time data?",
    "Request your GDPR data export from TV Time (or use the ZIP you already downloaded before the shutdown), then upload it as-is on the Import page. WatchDeck matches your shows, watched episodes and movies automatically — no unpacking or reformatting needed.",
  ],
  [
    "Is WatchDeck really free?",
    "Yes. Tracking, importing, statistics, the calendar, iCal feeds and email reminders are all free. There is no paywall on core features.",
  ],
  [
    "Does WatchDeck track movies as well as TV shows?",
    "Yes — both. Your library, watch history, calendar and statistics cover TV shows and movies together, and TV Time exports import both.",
  ],
  [
    "Can I import from Trakt, Serializd or Netflix?",
    "Yes. Any CSV export with a title column works (Trakt- and Serializd-style exports), and Netflix's ViewingActivity.csv is supported too — shows are added to your library and movies marked watched.",
  ],
  [
    "Can I get my data back out?",
    "Always. You can download your complete data (library, episodes, movies, ratings, notes) as JSON from Settings at any time, and delete your account whenever you want.",
  ],
  [
    "Do I need to install an app?",
    "No. WatchDeck runs entirely in your browser and works on phones, tablets and desktops.",
  ],
];

export const AuthForm: FC<{ mode: "login" | "signup"; error?: string; next?: string }> = ({ mode, error, next }) => (
  <div class="mx-auto max-w-sm py-10">
    <h1 class="mb-6 text-2xl font-bold">{mode === "login" ? "Log in" : "Create your free account"}</h1>
    {error && <p class="mb-4 rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</p>}
    <form action={`/${mode}`} method="post" class="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label for="auth-email" class="mb-1 block text-sm text-slate-400">Email</label>
        <input
          id="auth-email"
          type="email"
          name="email"
          required
          autocomplete="email"
          placeholder="you@example.com"
          class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 focus:border-violet-500 focus:outline-none"
        />
      </div>
      <div>
        <label for="auth-password" class="mb-1 block text-sm text-slate-400">Password{mode === "signup" ? " (8+ characters)" : ""}</label>
        <input
          id="auth-password"
          type="password"
          name="password"
          required
          minlength={8}
          autocomplete={mode === "signup" ? "new-password" : "current-password"}
          class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 focus:border-violet-500 focus:outline-none"
        />
      </div>
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
          <div>
            <label for="forgot-email" class="mb-1 block text-sm text-slate-400">Email</label>
            <input
              id="forgot-email"
              type="email"
              name="email"
              required
              autocomplete="email"
              placeholder="you@example.com"
              class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 focus:border-violet-500 focus:outline-none"
            />
          </div>
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
      <div>
        <label for="reset-password" class="mb-1 block text-sm text-slate-400">New password (8+ characters)</label>
        <input
          id="reset-password"
          type="password"
          name="password"
          required
          minlength={8}
          autocomplete="new-password"
          class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 focus:border-violet-500 focus:outline-none"
        />
      </div>
      <button class="w-full rounded-lg bg-violet-600 py-2.5 font-semibold text-white hover:bg-violet-500">Set new password</button>
    </form>
  </div>
);

export const MediaCard: FC<{ item: SearchResult; type: "tv" | "movie"; inLibrary?: boolean }> = ({ item, type, inLibrary }) => {
  const title = item.name ?? item.title ?? "Untitled";
  const year = (item.first_air_date ?? item.release_date ?? "").slice(0, 4);
  const href = type === "tv" ? `/shows/${item.id}-${slugify(title)}` : `/movies/${item.id}-${slugify(title)}`;
  return (
    <a href={href} class="group relative">
      {inLibrary && (
        <span class="absolute right-1.5 top-1.5 z-10 rounded-full bg-emerald-700/90 px-2 py-0.5 text-xs font-medium text-white" title="Already in your library">
          ✓ In library
        </span>
      )}
      <img
        src={poster(item.poster_path)}
        alt={title}
        loading="lazy"
        class="aspect-[2/3] w-full rounded-xl border border-slate-800 object-cover transition group-hover:border-violet-600"
      />
      <p class="mt-2 line-clamp-1 text-sm font-medium group-hover:text-violet-400">{title}</p>
      <p class="text-xs text-slate-400">
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

export interface WatchlistPreviewItem {
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string;
  poster_path: string | null;
}

export const HomePage: FC<{
  nextUp: NextUpItem[];
  watchlistCount: number;
  hasAnything: boolean;
  justWatched?: { tmdbId: number; season: number; episode: number } | null;
  watchlistPreview?: WatchlistPreviewItem[];
  upcoming?: CalendarItem[];
}> = ({ nextUp, watchlistCount, hasAnything, justWatched, watchlistPreview, upcoming }) => (
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
          <>
            <p class="text-slate-400">You're all caught up! 🎉 Check the <a href="/calendar" class="text-violet-400 hover:underline">calendar</a> for what's coming.</p>
            {(watchlistPreview?.length ?? 0) > 0 && (
              <div class="mt-8 text-left">
                <p class="mb-3 font-semibold">Start something from your watchlist</p>
                <div class="grid grid-cols-3 gap-4 sm:grid-cols-6">
                  {watchlistPreview!.map((w) => (
                    <a href={`/${w.media_type === "tv" ? "shows" : "movies"}/${w.tmdb_id}-${slugify(w.title)}`} class="group">
                      <img
                        src={poster(w.poster_path)}
                        alt={w.title}
                        loading="lazy"
                        class="aspect-[2/3] w-full rounded-xl border border-slate-800 object-cover transition group-hover:border-violet-600"
                      />
                      <p class="mt-2 line-clamp-1 text-sm group-hover:text-violet-400">{w.title}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
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
              <img src={poster(n.posterPath, "w154")} alt={n.title} class="aspect-[2/3] h-28 w-auto rounded-lg border border-slate-800 object-cover" />
            </a>
            <div class="min-w-0">
              <a href={`/shows/${n.tmdbId}-${slugify(n.title)}`} class="line-clamp-1 font-semibold hover:text-violet-400">{n.title}</a>
              <p class="mt-1 text-sm text-violet-300">
                S{String(n.season).padStart(2, "0")}E{String(n.episode).padStart(2, "0")}
                {n.episodeName ? ` · ${n.episodeName}` : ""}
              </p>
              {n.airDate && <p class="text-xs text-slate-400">aired {n.airDate}</p>}
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
    {(upcoming?.length ?? 0) > 0 && (
      <section class="mt-10">
        <h2 class="mb-3 flex items-baseline gap-3 text-lg font-semibold">
          Airing this week
          <a href="/calendar" class="text-sm font-normal text-violet-400 hover:underline">Full calendar →</a>
        </h2>
        <ul class="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800">
          {upcoming!.map((it) => (
            <li class="flex items-center gap-4 bg-slate-900/40 px-4 py-2.5">
              <span class="w-24 shrink-0 text-sm text-violet-300" title={it.airDate}>
                {airDateLabel(it.airDate).label}
              </span>
              <a href={`/${it.mediaType === "tv" ? "shows" : "movies"}/${it.tmdbId}-${slugify(it.title)}`} class="line-clamp-1 text-sm font-medium hover:text-violet-400">
                {it.title}
              </a>
              <span class="text-sm text-slate-400">
                {it.mediaType === "tv" && it.season != null && it.episode != null
                  ? `S${String(it.season).padStart(2, "0")}E${String(it.episode).padStart(2, "0")}`
                  : "🎬 Movie release"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    )}
    {watchlistCount > 0 && (
      <p class="mt-8 text-sm text-slate-400">
        You have {watchlistCount} title{watchlistCount === 1 ? "" : "s"} on your <a href="/library?status=watchlist" class="text-violet-400 hover:underline">watchlist</a>.
      </p>
    )}
  </div>
);

export const SearchPage: FC<{ q: string; results: SearchResult[]; libraryIds?: Set<string>; type?: "all" | "tv" | "movie" }> = ({ q, results, libraryIds, type = "all" }) => {
  const filtered = results.filter((r) => (r.media_type === "tv" || r.media_type === "movie") && (type === "all" || r.media_type === type));
  return (
    <div>
      <form action="/search" method="get" class="mb-6">
        <input
          type="search"
          name="q"
          value={q}
          autofocus={!q}
          placeholder="Search shows & movies…"
          class="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 placeholder-slate-500 focus:border-violet-500 focus:outline-none"
        />
      </form>
      {q && <h1 class="mb-4 text-xl font-semibold">Results for “{q}”</h1>}
      {q && (
        <div class="mb-6 flex gap-2" role="group" aria-label="Filter results by type">
          {(
            [
              ["all", "All"],
              ["tv", "TV shows"],
              ["movie", "Movies"],
            ] as const
          ).map(([t, label]) => (
            <a
              href={`/search?q=${encodeURIComponent(q)}${t === "all" ? "" : `&type=${t}`}`}
              aria-current={type === t ? "page" : undefined}
              class={`rounded-lg border px-3 py-1.5 text-sm ${type === t ? "border-violet-500 bg-violet-950/60 text-violet-300" : "border-slate-700 hover:border-violet-500 hover:text-violet-300"}`}
            >
              {label}
            </a>
          ))}
        </div>
      )}
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {filtered.map((r) => (
          <MediaCard item={r} type={r.media_type as "tv" | "movie"} inLibrary={libraryIds?.has(`${r.media_type}:${r.id}`)} />
        ))}
      </div>
      {q && filtered.length === 0 && (
        <p class="text-slate-400">
          Nothing found{type !== "all" ? ` in ${type === "tv" ? "TV shows" : "movies"} — try All` : " — check the spelling, or browse what's trending below"}.
        </p>
      )}
    </div>
  );
};

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

export const CastSection: FC<{ cast: CastMember[] }> = ({ cast }) =>
  cast.length === 0 ? null : (
    <div class="mt-12">
      <h2 class="mb-4 text-xl font-semibold">Top cast</h2>
      <ul class="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
        {cast.map((m) => (
          <li class="text-center">
            <img
              src={m.profile_path ? `https://image.tmdb.org/t/p/w185${m.profile_path}` : "/placeholder-poster.svg"}
              alt={m.name}
              loading="lazy"
              class="mx-auto aspect-[2/3] w-full max-w-[7rem] rounded-xl border border-slate-800 object-cover"
            />
            <p class="mt-2 line-clamp-1 text-sm font-medium">{m.name}</p>
            {m.character && <p class="line-clamp-1 text-xs text-slate-400">{m.character}</p>}
          </li>
        ))}
      </ul>
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

export const NotesBox: FC<{ tmdbId: number; mediaType: "tv" | "movie"; notes: string | null; redirect: string }> = ({ tmdbId, mediaType, notes, redirect }) => (
  <details class="mt-3 max-w-2xl" open={!!notes}>
    <summary class="cursor-pointer text-sm text-slate-400 hover:text-violet-300">📝 Private notes{notes ? " · saved" : ""}</summary>
    <form action="/api/notes" method="post" class="mt-2">
      <input type="hidden" name="tmdb_id" value={String(tmdbId)} />
      <input type="hidden" name="media_type" value={mediaType} />
      <input type="hidden" name="redirect" value={redirect} />
      <textarea
        name="notes"
        rows={3}
        maxlength={2000}
        placeholder="Your thoughts — only you can see this"
        aria-label="Private notes"
        class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm placeholder-slate-500 focus:border-violet-500 focus:outline-none"
      >
        {notes ?? ""}
      </textarea>
      <button class="mt-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:border-violet-500 hover:text-violet-300">Save notes</button>
    </form>
  </details>
);

export const WhereToWatch: FC<{ providers: WatchProviders | null }> = ({ providers }) =>
  !providers?.flatrate?.length ? null : (
    <div class="mt-4">
      <p class="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Where to stream (US)</p>
      <div class="flex flex-wrap items-center gap-2">
        {providers.flatrate.slice(0, 6).map((p) => (
          <a href={providers.link} rel="noopener" title={`Stream on ${p.provider_name}`} class="block">
            <img
              src={`https://image.tmdb.org/t/p/w45${p.logo_path}`}
              alt={p.provider_name}
              width={32}
              height={32}
              loading="lazy"
              class="rounded-lg border border-slate-800"
            />
          </a>
        ))}
        <span class="text-xs text-slate-400">
          data by <a href="https://www.justwatch.com/" rel="noopener" class="hover:underline">JustWatch</a>
        </span>
      </div>
    </div>
  );

export const ShowPage: FC<{
  show: TvDetails;
  season: SeasonDetails | null;
  watched: Set<string>;
  tracked: { status: string; rating: number | null; notes: string | null } | null;
  user: User | null;
  recs: SearchResult[];
  providers?: WatchProviders | null;
  cast?: CastMember[];
}> = ({ show, season, watched, tracked, user, recs, providers, cast }) => {
  const showUrl = `/shows/${show.id}-${slugify(show.name)}`;
  return (
    <div>
      <div class="flex flex-col gap-6 sm:flex-row">
        <img src={poster(show.poster_path)} alt={show.name} class="aspect-[2/3] w-40 self-start rounded-xl border border-slate-800 object-cover sm:w-52" />
        <div class="min-w-0 flex-1">
          <h1 class="text-3xl font-bold">{show.name}</h1>
          <p class="mt-1 text-sm text-slate-400">
            {show.first_air_date?.slice(0, 4)} · {show.number_of_seasons} season{show.number_of_seasons === 1 ? "" : "s"} ·{" "}
            {show.number_of_episodes} episodes · {show.status} · ★ {show.vote_average?.toFixed(1)}
          </p>
          <p class="mt-1 text-sm text-slate-400">{show.genres.map((g) => g.name).join(", ")}</p>
          {show.next_episode_to_air?.air_date && (
            <p class="mt-3 inline-block rounded-lg border border-violet-800 bg-violet-950/50 px-3 py-1.5 text-sm text-violet-300">
              Next episode: S{String(show.next_episode_to_air.season_number).padStart(2, "0")}E
              {String(show.next_episode_to_air.episode_number).padStart(2, "0")}
              {show.next_episode_to_air.name ? ` — ${show.next_episode_to_air.name}` : ""} ·{" "}
              {new Date(show.next_episode_to_air.air_date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
            </p>
          )}
          <p class="mt-4 max-w-2xl text-slate-300">{show.overview}</p>
          <WhereToWatch providers={providers ?? null} />
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
              {tracked && (
                <form action="/api/untrack" method="post">
                  <input type="hidden" name="tmdb_id" value={String(show.id)} />
                  <input type="hidden" name="media_type" value="tv" />
                  <input type="hidden" name="redirect" value={showUrl} />
                  <button class="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-red-400" title="Removes it from your library; watch history is kept">
                    Remove
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div class="mt-5 flex flex-wrap items-center gap-3">
              <a href={`/signup?next=${encodeURIComponent(showUrl)}`} class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">Track this show — join free</a>
              <a href="/signup" class="text-sm text-violet-400 hover:underline">Coming from TV Time? Import your export →</a>
            </div>
          )}
          {user && (
            <RatingStars tmdbId={show.id} mediaType="tv" title={show.name} posterPath={show.poster_path} rating={tracked?.rating ?? null} redirect={showUrl} />
          )}
          {user && tracked && <NotesBox tmdbId={show.id} mediaType="tv" notes={tracked.notes} redirect={showUrl} />}
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
                  <span class="w-14 shrink-0 text-sm text-slate-400">
                    S{String(ep.season_number).padStart(2, "0")}E{String(ep.episode_number).padStart(2, "0")}
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="line-clamp-1 font-medium">{ep.name}</p>
                    <p class="text-xs text-slate-400">{ep.air_date ?? "TBA"}</p>
                  </div>
                  {user && (
                    <div class="flex shrink-0 items-center gap-2">
                      {!isWatched && (
                        <form action="/api/watch-up-to" method="post">
                          <input type="hidden" name="tmdb_id" value={String(show.id)} />
                          <input type="hidden" name="season" value={String(ep.season_number)} />
                          <input type="hidden" name="episode" value={String(ep.episode_number)} />
                          <input type="hidden" name="redirect" value={`${showUrl}?season=${season.season_number}`} />
                          <button
                            class="rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:text-violet-300"
                            title={`Mark everything up to S${String(ep.season_number).padStart(2, "0")}E${String(ep.episode_number).padStart(2, "0")} watched`}
                            aria-label={`Mark everything up to season ${ep.season_number} episode ${ep.episode_number} watched`}
                          >
                            ⇤ up to here
                          </button>
                        </form>
                      )}
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
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <CastSection cast={cast ?? []} />
      <RecsSection recs={recs} type="tv" />
    </div>
  );
};

export const MoviePage: FC<{
  movie: MovieDetails;
  watched: boolean;
  tracked: { status: string; rating: number | null; notes: string | null } | null;
  user: User | null;
  recs: SearchResult[];
  providers?: WatchProviders | null;
  cast?: CastMember[];
}> = ({ movie, watched, tracked, user, recs, providers, cast }) => {
  const movieUrl = `/movies/${movie.id}-${slugify(movie.title)}`;
  return (
    <div>
    <div class="flex flex-col gap-6 sm:flex-row">
      <img src={poster(movie.poster_path)} alt={movie.title} class="aspect-[2/3] w-40 self-start rounded-xl border border-slate-800 object-cover sm:w-52" />
      <div class="min-w-0 flex-1">
        <h1 class="text-3xl font-bold">{movie.title}</h1>
        <p class="mt-1 text-sm text-slate-400">
          {movie.release_date?.slice(0, 4)} {movie.runtime ? `· ${movie.runtime} min` : ""} · ★ {movie.vote_average?.toFixed(1)}
        </p>
        <p class="mt-1 text-sm text-slate-400">{movie.genres.map((g) => g.name).join(", ")}</p>
        <p class="mt-4 max-w-2xl text-slate-300">{movie.overview}</p>
        <WhereToWatch providers={providers ?? null} />
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
            {tracked && (
              <form action="/api/untrack" method="post">
                <input type="hidden" name="tmdb_id" value={String(movie.id)} />
                <input type="hidden" name="media_type" value="movie" />
                <input type="hidden" name="redirect" value={movieUrl} />
                <button class="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-red-400" title="Removes it from your library; watch history is kept">
                  Remove
                </button>
              </form>
            )}
          </div>
        ) : (
          <div class="mt-5 flex flex-wrap items-center gap-3">
            <a href={`/signup?next=${encodeURIComponent(movieUrl)}`} class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">Track this movie — join free</a>
            <a href="/signup" class="text-sm text-violet-400 hover:underline">Coming from TV Time? Import your export →</a>
          </div>
        )}
        {user && (
          <RatingStars tmdbId={movie.id} mediaType="movie" title={movie.title} posterPath={movie.poster_path} rating={tracked?.rating ?? null} redirect={movieUrl} />
        )}
        {user && tracked && <NotesBox tmdbId={movie.id} mediaType="movie" notes={tracked.notes} redirect={movieUrl} />}
      </div>
    </div>
    <CastSection cast={cast ?? []} />
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

export const LibraryPage: FC<{ rows: LibraryRow[]; status: string; sort: string; q?: string; counts?: Record<string, number>; page?: number; lastPage?: number }> = ({ rows, status, sort, q, counts, page = 1, lastPage = 1 }) => (
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
          {counts && (
            <span class={status === s ? "ml-1.5 text-xs text-violet-200" : "ml-1.5 text-xs text-slate-500"}>
              {s === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[s] ?? 0}
            </span>
          )}
        </a>
      ))}
    </div>
    <div class="mb-6 flex flex-wrap items-center gap-2 text-sm">
      <span class="text-slate-400">Sort:</span>
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
          <div>
            <a href={`/${r.media_type === "tv" ? "shows" : "movies"}/${r.tmdb_id}-${slugify(r.title)}`} class="group block">
              <img
                src={poster(r.poster_path)}
                alt={r.title}
                loading="lazy"
                class="aspect-[2/3] w-full rounded-xl border border-slate-800 object-cover transition group-hover:border-violet-600"
              />
              <p class="mt-2 line-clamp-1 text-sm font-medium group-hover:text-violet-400">{r.title}</p>
              <p class="text-xs text-slate-400">
                {r.media_type === "tv" && r.eps_watched > 0 ? `${r.eps_watched} ep${r.eps_watched === 1 ? "" : "s"} watched` : ""}
                {r.rating ? <span class="text-amber-400">{r.media_type === "tv" && r.eps_watched > 0 ? " · " : ""}★ {r.rating}</span> : ""}
              </p>
            </a>
            <form action="/api/track" method="post" class="mt-1">
              <input type="hidden" name="tmdb_id" value={String(r.tmdb_id)} />
              <input type="hidden" name="media_type" value={r.media_type} />
              <input
                type="hidden"
                name="redirect"
                value={`/library?${status === "all" ? "" : `status=${status}&`}sort=${sort}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              />
              <select
                name="status"
                aria-label={`Status for ${r.title}`}
                data-autosubmit
                class="w-full rounded-md border border-slate-800 bg-slate-900 px-1.5 py-1 text-xs text-slate-300 focus:border-violet-500 focus:outline-none"
              >
                {(["watching", "watchlist", "completed", "dropped"] as const).map((s) => (
                  <option value={s} selected={r.status === s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
              <noscript>
                <button class="mt-1 rounded-md border border-slate-700 px-2 py-1 text-xs">Save</button>
              </noscript>
            </form>
          </div>
        ))}
      </div>
    )}
    {lastPage > 1 && (
      <nav class="mt-8 flex items-center justify-center gap-4 text-sm" aria-label="Library pages">
        {page > 1 ? (
          <a
            href={`/library?${status === "all" ? "" : `status=${status}&`}sort=${sort}${q ? `&q=${encodeURIComponent(q)}` : ""}&page=${page - 1}`}
            class="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-violet-500"
          >
            ← Previous
          </a>
        ) : (
          <span class="rounded-lg border border-slate-800 px-3 py-1.5 text-slate-600">← Previous</span>
        )}
        <span class="text-slate-400">
          Page {page} of {lastPage}
        </span>
        {page < lastPage ? (
          <a
            href={`/library?${status === "all" ? "" : `status=${status}&`}sort=${sort}${q ? `&q=${encodeURIComponent(q)}` : ""}&page=${page + 1}`}
            class="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-violet-500"
          >
            Next →
          </a>
        ) : (
          <span class="rounded-lg border border-slate-800 px-3 py-1.5 text-slate-600">Next →</span>
        )}
      </nav>
    )}
  </div>
);

export interface CalendarItem {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  mediaType: "tv" | "movie";
  season: number | null;
  episode: number | null;
  episodeName: string | null;
  airDate: string;
}

const airDateLabel = (iso: string): { label: string; today: boolean } => {
  const todayIso = new Date().toISOString().slice(0, 10);
  if (iso === todayIso) return { label: "Today", today: true };
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (iso === tomorrow) return { label: "Tomorrow", today: false };
  return {
    label: new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }),
    today: false,
  };
};

export const CalendarPage: FC<{ items: CalendarItem[]; feedUrl: string; remindEmail: boolean }> = ({ items, feedUrl, remindEmail }) => (
  <div>
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <h1 class="text-2xl font-bold">Upcoming episodes &amp; releases</h1>
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
        {items.map((it) => {
          const d = airDateLabel(it.airDate);
          return (
          <li class={d.today ? "flex items-center gap-4 bg-violet-950/40 px-4 py-3" : "flex items-center gap-4 bg-slate-900/40 px-4 py-3"}>
            <span class={d.today ? "w-24 shrink-0 text-sm font-semibold text-violet-300" : "w-24 shrink-0 text-sm text-violet-300"} title={it.airDate}>{d.label}</span>
            <img src={poster(it.posterPath, "w92")} alt="" class="aspect-[2/3] h-14 w-auto rounded border border-slate-800 object-cover" />
            <div class="min-w-0">
              <a href={`/${it.mediaType === "tv" ? "shows" : "movies"}/${it.tmdbId}-${slugify(it.title)}`} class="line-clamp-1 font-medium hover:text-violet-400">
                {it.title}
              </a>
              <p class="text-sm text-slate-400">
                {it.mediaType === "tv" && it.season != null && it.episode != null
                  ? `S${String(it.season).padStart(2, "0")}E${String(it.episode).padStart(2, "0")}${it.episodeName ? ` · ${it.episodeName}` : ""}`
                  : "🎬 Movie release"}
              </p>
            </div>
          </li>
          );
        })}
      </ul>
    )}
  </div>
);

export const BrowseIndex: FC<{
  tvGenres: { id: number; name: string }[];
  movieGenres: { id: number; name: string }[];
  networks: readonly { id: number; name: string }[];
  years: number[];
}> = ({ tvGenres, movieGenres, networks, years }) => (
  <div>
    <h1 class="mb-2 text-2xl font-bold">Browse TV shows &amp; movies</h1>
    <p class="mb-8 text-slate-400">Find your next watch by genre, year or network — powered by TMDB.</p>
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
    <section class="mb-10">
      <h2 class="mb-4 text-xl font-semibold">By year</h2>
      {(
        [
          ["TV shows", "tv"],
          ["Movies", "movie"],
        ] as const
      ).map(([label, type]) => (
        <div class="mb-4">
          <h3 class="mb-2 text-sm font-medium text-slate-400">{label}</h3>
          <div class="flex flex-wrap gap-2">
            {years.map((y) => (
              <a
                href={`/browse/year/${type}/${y}`}
                class="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:border-violet-500 hover:text-violet-300"
              >
                {y}
              </a>
            ))}
          </div>
        </div>
      ))}
    </section>
    <section class="mb-10">
      <h2 class="mb-4 text-xl font-semibold">By network</h2>
      <div class="flex flex-wrap gap-2">
        {networks.map((n) => (
          <a
            href={`/browse/network/${n.id}-${slugify(n.name)}`}
            class="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:border-violet-500 hover:text-violet-300"
          >
            {n.name}
          </a>
        ))}
      </div>
    </section>
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
        <span class="text-slate-400">Page {page} of {Math.min(totalPages, 20)}</span>
        {page < Math.min(totalPages, 20) && <a href={`${base}?page=${page + 1}`} class="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-violet-500">Next →</a>}
      </div>
    </div>
  );
};

export const BrowseNetwork: FC<{
  network: { id: number; name: string };
  results: SearchResult[];
  page: number;
  totalPages: number;
}> = ({ network, results, page, totalPages }) => {
  const base = `/browse/network/${network.id}-${slugify(network.name)}`;
  return (
    <div>
      <h1 class="mb-2 text-2xl font-bold">{network.name} TV shows</h1>
      <p class="mb-6 text-slate-400">
        Popular series on {network.name} to track on WatchDeck.{" "}
        <a href="/browse" class="text-violet-400 hover:underline">All genres &amp; networks</a>
      </p>
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {results.map((r) => (
          <MediaCard item={r} type="tv" />
        ))}
      </div>
      <div class="mt-8 flex items-center gap-3 text-sm">
        {page > 1 && <a href={`${base}?page=${page - 1}`} class="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-violet-500">← Previous</a>}
        <span class="text-slate-400">Page {page} of {Math.min(totalPages, 20)}</span>
        {page < Math.min(totalPages, 20) && <a href={`${base}?page=${page + 1}`} class="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-violet-500">Next →</a>}
      </div>
    </div>
  );
};

export const BrowseYear: FC<{
  type: "tv" | "movie";
  year: number;
  results: SearchResult[];
  page: number;
  totalPages: number;
}> = ({ type, year, results, page, totalPages }) => {
  const base = `/browse/year/${type}/${year}`;
  return (
    <div>
      <h1 class="mb-2 text-2xl font-bold">
        {type === "tv" ? "TV shows" : "Movies"} of {year}
      </h1>
      <p class="mb-6 text-slate-400">
        The most popular {type === "tv" ? `series that premiered in ${year}` : `films released in ${year}`}, ready to track on WatchDeck.{" "}
        <a href="/browse" class="text-violet-400 hover:underline">All genres &amp; years</a>
      </p>
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {results.map((r) => (
          <MediaCard item={r} type={type} />
        ))}
      </div>
      <div class="mt-8 flex items-center gap-3 text-sm">
        {page > 1 && <a href={`${base}?page=${page - 1}`} class="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-violet-500">← Previous</a>}
        <span class="text-slate-400">Page {page} of {Math.min(totalPages, 20)}</span>
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
  byYear: { year: string; eps: number; movies: number }[];
  topGenres: { name: string; count: number }[];
  epsThisYear: number;
  moviesThisYear: number;
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
      {(stats.epsThisYear > 0 || stats.moviesThisYear > 0) && (
        <p class="mt-4 text-sm text-slate-400">
          So far in {new Date().getUTCFullYear()}: <span class="font-semibold text-violet-300">{stats.epsThisYear}</span> episode{stats.epsThisYear === 1 ? "" : "s"} and{" "}
          <span class="font-semibold text-violet-300">{stats.moviesThisYear}</span> movie{stats.moviesThisYear === 1 ? "" : "s"} watched.
        </p>
      )}
      <div class="mt-8 grid gap-6 md:grid-cols-2">
        <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 class="mb-4 font-semibold">Most-watched shows</h2>
          {stats.topShows.length === 0 ? (
            <p class="text-sm text-slate-400">No episodes tracked yet.</p>
          ) : (
            <ol class="space-y-2">
              {stats.topShows.map((s, i) => (
                <li class="flex items-center gap-3 text-sm">
                  <span class="w-5 text-slate-400">{i + 1}.</span>
                  <a href={`/shows/${s.tmdb_id}-${slugify(s.title)}`} class="flex-1 truncate hover:text-violet-400">{s.title}</a>
                  <span class="text-slate-400">{s.eps} eps</span>
                </li>
              ))}
            </ol>
          )}
          {stats.topShows.length > 0 && stats.topShows.length < stats.showsTracked && (
            <p class="mt-3 text-xs text-slate-400">Your other tracked shows appear here once you log episodes for them.</p>
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
                  <span class="w-16 shrink-0 text-slate-400">{m.month}</span>
                  <div class="h-3 rounded bg-gradient-to-r from-violet-600 to-fuchsia-500" style={`width:${Math.max(2, Math.round((m.eps / maxMonth) * 100))}%`} />
                  <span class="text-slate-400">{m.eps}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {stats.byYear.length > 0 && (
        <div class="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 class="mb-4 font-semibold">By year</h2>
          <ul class="space-y-1.5">
            {stats.byYear.map((y) => {
              const total = y.eps + y.movies;
              const maxYear = Math.max(1, ...stats.byYear.map((r) => r.eps + r.movies));
              return (
                <li class="flex items-center gap-2 text-xs">
                  <span class="w-16 shrink-0 text-slate-400">{y.year}</span>
                  <div class="h-3 rounded bg-gradient-to-r from-violet-600 to-fuchsia-500" style={`width:${Math.max(2, Math.round((total / maxYear) * 100))}%`} />
                  <span class="whitespace-nowrap text-slate-400">
                    {y.eps} ep{y.eps === 1 ? "" : "s"}{y.movies > 0 ? ` · ${y.movies} movie${y.movies === 1 ? "" : "s"}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {stats.topGenres.length > 0 && (
        <div class="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 class="mb-4 font-semibold">Top genres</h2>
          <ul class="space-y-1.5">
            {stats.topGenres.map((g) => (
              <li class="flex items-center gap-2 text-xs">
                <span class="w-28 shrink-0 truncate text-slate-400">{g.name}</span>
                <div class="h-3 rounded bg-gradient-to-r from-violet-600 to-fuchsia-500" style={`width:${Math.max(2, Math.round((g.count / Math.max(1, stats.topGenres[0].count)) * 100))}%`} />
                <span class="text-slate-400">{g.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export const PrivacyPage: FC = () => (
  <div class="prose-invert mx-auto max-w-2xl space-y-4 text-slate-300">
    <h1 class="text-2xl font-bold text-white">Privacy policy</h1>
    <p class="text-sm text-slate-400">Last updated: August 5, 2026</p>
    <h2 class="text-lg font-semibold text-white">What we collect</h2>
    <p>
      Your email address and password (stored as a salted PBKDF2-SHA256 hash), the shows, movies, episodes and ratings
      you track, and any display name you set. If you upload a TV Time export or CSV, we parse it to extract titles and
      watch records and store only those — the uploaded file itself is never retained.
    </p>
    <h2 class="text-lg font-semibold text-white">Analytics without cookies</h2>
    <p>
      We use first-party, cookie-free analytics: we count page views with the country provided by our CDN and a coarse
      browser class. We do not store IP addresses, do not fingerprint devices, do not use tracking cookies, and do not
      share or sell data to anyone. The only cookie we set is the session cookie that keeps you logged in.
    </p>
    <h2 class="text-lg font-semibold text-white">Emails</h2>
    <p>
      We only email you when you ask us to: airing reminders you switch on (opt-out anytime on the calendar page),
      password resets you request, and a welcome note on signup. We never send marketing emails without consent.
    </p>
    <h2 class="text-lg font-semibold text-white">Your rights</h2>
    <p>
      You can delete your account and all associated data at any time from{" "}
      <a href="/settings" class="text-violet-400 hover:underline">Settings</a> — deletion is immediate and permanent.
      For questions or data requests, contact{" "}
      <a href="mailto:watchdeck@zalize.com" class="text-violet-400 hover:underline">watchdeck@zalize.com</a>.
    </p>
    <h2 class="text-lg font-semibold text-white">Third parties</h2>
    <p>
      Show and movie metadata comes from <a href="https://www.themoviedb.org/" rel="noopener" class="text-violet-400 hover:underline">TMDB</a>.
      Poster images are loaded from TMDB's image CDN. Transactional email is delivered by Resend. Hosting is provided by Cloudflare.
    </p>
  </div>
);

export const TermsPage: FC = () => (
  <div class="mx-auto max-w-2xl space-y-4 text-slate-300">
    <h1 class="text-2xl font-bold text-white">Terms of service</h1>
    <p class="text-sm text-slate-400">Last updated: August 5, 2026</p>
    <p>
      WatchDeck is a free service for tracking TV shows and movies. By using it you agree to these terms.
    </p>
    <h2 class="text-lg font-semibold text-white">Your account</h2>
    <p>
      You are responsible for keeping your password safe. You may delete your account at any time from Settings.
      We may suspend accounts that abuse the service (automated scraping, spam, attempts to disrupt it).
    </p>
    <h2 class="text-lg font-semibold text-white">The service</h2>
    <p>
      WatchDeck is provided "as is" without warranty. We aim for high availability but do not guarantee it. Metadata is
      provided by TMDB and may contain errors; this product uses the TMDB API but is not endorsed or certified by TMDB.
    </p>
    <h2 class="text-lg font-semibold text-white">Changes</h2>
    <p>
      We may update these terms; material changes will be noted on this page. Continued use after changes constitutes
      acceptance. Contact: <a href="mailto:watchdeck@zalize.com" class="text-violet-400 hover:underline">watchdeck@zalize.com</a>.
    </p>
  </div>
);

export const SettingsPage: FC<{ user: User; saved?: string; error?: string }> = ({ user, saved, error }) => (
  <div class="mx-auto max-w-lg">
    <h1 class="mb-6 text-2xl font-bold">Settings</h1>
    {saved && <p class="mb-4 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-300">{saved}</p>}
    {error && <p class="mb-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-300">{error}</p>}
    <section class="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
      <h2 class="font-semibold">Profile</h2>
      <p class="mt-1 text-sm text-slate-400">Signed in as {user.email}</p>
      <form action="/api/settings/profile" method="post" class="mt-4 flex gap-2">
        <input
          type="text"
          name="display_name"
          value={user.display_name ?? ""}
          maxlength={40}
          placeholder="Display name"
          aria-label="Display name"
          class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm placeholder-slate-500 focus:border-violet-500 focus:outline-none"
        />
        <button class="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">Save</button>
      </form>
      <p class="mt-2 text-xs text-slate-400">Shown on your public share page instead of a generic label.</p>
    </section>
    <section class="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
      <h2 class="font-semibold">Change password</h2>
      <form action="/api/settings/password" method="post" class="mt-4 space-y-3">
        <input type="password" name="current" required autocomplete="current-password" placeholder="Current password" aria-label="Current password" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm placeholder-slate-500 focus:border-violet-500 focus:outline-none" />
        <input type="password" name="next" required minlength={8} autocomplete="new-password" placeholder="New password (min 8 characters)" aria-label="New password" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm placeholder-slate-500 focus:border-violet-500 focus:outline-none" />
        <button class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">Update password</button>
      </form>
    </section>
    <section class="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
      <h2 class="font-semibold">Export your data</h2>
      <p class="mt-1 text-sm text-slate-400">
        Download everything you've tracked — library, statuses, ratings and full watch history — as a JSON file. Your data is always yours to take.
      </p>
      <a href="/api/export" class="mt-4 inline-block rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:border-violet-500 hover:text-violet-300" download>
        Download export (JSON)
      </a>
    </section>
    <section class="mt-6 rounded-2xl border border-red-900/60 bg-red-950/20 p-6">
      <h2 class="font-semibold text-red-300">Delete account</h2>
      <p class="mt-1 text-sm text-slate-400">
        Permanently deletes your account and all data — library, watch history, ratings, share page and calendar feed. This cannot be undone.
      </p>
      <form action="/api/settings/delete" method="post" class="mt-4 flex gap-2" data-confirm="Delete your account and all data permanently?">
        <input type="password" name="password" required autocomplete="current-password" placeholder="Confirm with your password" aria-label="Confirm password to delete account" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm placeholder-slate-500 focus:border-red-500 focus:outline-none" />
        <button class="shrink-0 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600">Delete</button>
      </form>
    </section>
  </div>
);

export interface HistoryItem {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  posterPath: string | null;
  season: number | null;
  episode: number | null;
  watchedAt: string;
}

export const HistoryPage: FC<{ items: HistoryItem[]; page?: number; lastPage?: number }> = ({ items, page = 1, lastPage = 1 }) => (
  <div>
    <h1 class="mb-6 text-2xl font-bold">History</h1>
    {items.length === 0 ? (
      <p class="text-slate-400">
        Nothing watched yet. <a href="/home" class="text-violet-400 hover:underline">Mark an episode watched</a> and it shows up here.
      </p>
    ) : (
      (() => {
        const groups: { day: string; rows: HistoryItem[] }[] = [];
        for (const it of items) {
          const day = it.watchedAt.slice(0, 10);
          const last = groups[groups.length - 1];
          if (last && last.day === day) last.rows.push(it);
          else groups.push({ day, rows: [it] });
        }
        const dayLabel = (iso: string) => {
          const today = new Date().toISOString().slice(0, 10);
          if (iso === today) return "Today";
          if (iso === new Date(Date.now() - 86400000).toISOString().slice(0, 10)) return "Yesterday";
          return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
        };
        return (
          <div class="space-y-6">
            {groups.map((g) => (
              <section>
                <h2 class="mb-2 text-sm font-semibold text-slate-400" title={g.day}>{dayLabel(g.day)}</h2>
                <ul class="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/50">
                  {g.rows.map((it) => (
                    <li class="flex items-center gap-4 px-4 py-3">
                      <a href={`/${it.mediaType === "tv" ? "shows" : "movies"}/${it.tmdbId}-${slugify(it.title)}`} class="shrink-0">
                        <img src={poster(it.posterPath, "w92")} alt={it.title} loading="lazy" class="h-16 w-auto rounded-md border border-slate-800 object-cover" />
                      </a>
                      <div class="min-w-0 flex-1">
                        <a href={`/${it.mediaType === "tv" ? "shows" : "movies"}/${it.tmdbId}-${slugify(it.title)}`} class="line-clamp-1 font-medium hover:text-violet-400">
                          {it.title}
                        </a>
                        <p class="text-sm text-slate-400">
                          {it.mediaType === "tv" && it.season != null && it.episode != null
                            ? `S${String(it.season).padStart(2, "0")}E${String(it.episode).padStart(2, "0")}`
                            : "Movie"}
                        </p>
                      </div>
                      <form action={it.mediaType === "tv" ? "/api/watch" : "/api/watch-movie"} method="post" class="shrink-0">
                        <input type="hidden" name="tmdb_id" value={String(it.tmdbId)} />
                        {it.mediaType === "tv" && it.season != null && it.episode != null && (
                          <>
                            <input type="hidden" name="season" value={String(it.season)} />
                            <input type="hidden" name="episode" value={String(it.episode)} />
                          </>
                        )}
                        <input type="hidden" name="undo" value="1" />
                        <input type="hidden" name="redirect" value={`/history${page > 1 ? `?page=${page}` : ""}`} />
                        <button
                          class="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:border-red-500 hover:text-red-400"
                          aria-label={`Remove ${it.title}${it.mediaType === "tv" && it.season != null && it.episode != null ? ` S${String(it.season).padStart(2, "0")}E${String(it.episode).padStart(2, "0")}` : ""} from history`}
                        >
                          Remove
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        );
      })()
    )}
    {lastPage > 1 && (
      <nav class="mt-8 flex items-center justify-center gap-4 text-sm" aria-label="History pages">
        {page > 1 ? (
          <a href={`/history?page=${page - 1}`} class="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-violet-500">← Previous</a>
        ) : (
          <span class="rounded-lg border border-slate-800 px-3 py-1.5 text-slate-600">← Previous</span>
        )}
        <span class="text-slate-400">Page {page} of {lastPage}</span>
        {page < lastPage ? (
          <a href={`/history?page=${page + 1}`} class="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-violet-500">Next →</a>
        ) : (
          <span class="rounded-lg border border-slate-800 px-3 py-1.5 text-slate-600">Next →</span>
        )}
      </nav>
    )}
  </div>
);

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
      from Trakt or Serializd? A CSV export with a title column works too. Netflix's ViewingActivity.csv also works — shows are added to
      your library and movies marked watched (Netflix doesn't export episode numbers).
    </p>
    <div
      id="dropzone"
      class="mt-6 cursor-pointer rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 p-10 text-center transition hover:border-violet-500"
    >
      <p class="text-lg">📦 Drag & drop your TV Time ZIP (or CSV) here</p>
      <p class="mt-1 text-sm text-slate-400">or click to choose the file</p>
      <input id="zipfile" type="file" accept=".zip,.csv" class="hidden" />
    </div>
    <div id="progress" class="mt-6 hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
      <p id="progress-text" class="font-medium">Parsing your export…</p>
      <div class="mt-3 h-2 overflow-hidden rounded bg-slate-800">
        <div id="progress-bar" class="h-full w-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all" />
      </div>
      <p id="progress-detail" class="mt-2 text-sm text-slate-400"></p>
    </div>
    <div id="confirm" class="mt-6 hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
      <p class="font-semibold">Ready to import</p>
      <p id="confirm-detail" class="mt-1 text-sm text-slate-300"></p>
      <div class="mt-4 flex gap-3">
        <button id="confirm-btn" class="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500">Import now</button>
        <button id="cancel-btn" class="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 hover:border-red-500 hover:text-red-400">Cancel</button>
      </div>
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
