import type { FC, PropsWithChildren } from "hono/jsx";
import type { User } from "./types";
import { poster, slugify, STREAMING_SERVICES, type SearchResult, type TvDetails, type MovieDetails, type SeasonDetails, type WatchProviders, type CastMember, type PersonDetails, type PersonCredit } from "./tmdb";

// bump on every CSS-affecting change: cached styles.css is served for up to 1h + SWR 24h
export const CSS_VERSION = 169;

const Hint: FC<{ tip: string }> = ({ tip }) => (
  <span class="hint" tabindex={0} role="note" aria-label={tip} data-tip={tip}>
    ?
  </span>
);

const BOTTOM_TABS: [string, string, string][] = [
  ["/home", "Next Up", "M8 5.5v13l10.5-6.5L8 5.5Z"],
  ["/search", "Search", "M10.5 4a6.5 6.5 0 1 0 4.1 11.55L19.5 20.5l1-1-4.9-4.95A6.5 6.5 0 0 0 10.5 4Zm0 1.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"],
  ["/library", "Library", "M5 4h10a2 2 0 0 1 2 2v14l-7-3.5L3 20V6a2 2 0 0 1 2-2Zm14 0a2 2 0 0 1 2 2v12.5l-1.5-.75V6a.5.5 0 0 0-.5-.5V4Z"],
  ["/calendar", "Calendar", "M7 3v2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2V3h-2v2H9V3H7Zm-2 6h14v10H5V9Z"],
  ["/more", "More", "M6 10.5a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5Zm6 0a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5Zm6 0a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5Z"],
];

const BottomNav: FC = () => (
  <nav id="bottom-nav" aria-label="Primary" class="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur sm:hidden" style="padding-bottom:env(safe-area-inset-bottom)">
    <div class="grid grid-cols-5">
      {BOTTOM_TABS.map(([href, label, d]) => (
        <a href={href} class="flex min-h-[52px] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-slate-200">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d={d} />
          </svg>
          {label}
        </a>
      ))}
    </div>
  </nav>
);

export interface ListRef {
  id: number;
  name: string;
  has: number;
}

export const Layout: FC<PropsWithChildren<{ user: User | null; title?: string; description?: string; canonical?: string; ogImage?: string; ogType?: string; jsonLd?: object; prev?: string; next?: string }>> = ({
  children,
  user,
  title,
  description,
  canonical,
  ogImage,
  ogType,
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
        content={description ?? "WatchDeck is a web-first TV show and movie tracker, free while in beta. Import your TV Time export in one click and pick up right where you left off."}
      />
      {canonical && <link rel="canonical" href={canonical} />}
      {prev && <link rel="prev" href={prev} />}
      {next && <link rel="next" href={next} />}
      <meta property="og:title" content={title ? `${title} — WatchDeck` : "WatchDeck — Track your TV shows & movies on the web"} />
      {description && <meta property="og:description" content={description} />}
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:site_name" content="WatchDeck" />
      <meta property="og:type" content={ogType ?? "website"} />
      <meta property="og:image" content={ogImage ?? "https://watchdeck.zalize.com/og-default.png"} />
      <meta property="og:image:alt" content={title ? `${title} — WatchDeck` : "WatchDeck — Track your TV shows & movies on the web"} />
      <meta property="og:locale" content="en_US" />
      <meta name="twitter:card" content="summary_large_image" />
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <link rel="preconnect" href="https://image.tmdb.org" />
      <link rel="preload" href="/fonts/sora-latin.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
      <link rel="stylesheet" href={`/styles.css?v=${CSS_VERSION}`} />
      <script src={`/app.js?v=${CSS_VERSION}`} defer></script>
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
      <nav id="site-nav" class="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 px-4 py-3 xl:max-w-7xl">
          <a href={user ? "/home" : "/"} data-logo class="flex items-center gap-2 text-lg font-bold tracking-tight">
            <img src="/favicon.svg" alt="" width="24" height="24" class="h-6 w-6" />
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
          <div class={`ml-auto items-center gap-2 text-sm sm:gap-3 whitespace-nowrap [&>*]:shrink-0 ${user ? "hidden sm:flex" : "flex"}`}>
            {!user && <a href="/search" class="sm:hidden" aria-label="Search">🔍</a>}
            <a href="/browse" class="px-1 py-2 hover:text-violet-400">Browse</a>
            {user ? (
              <>
                <a href="/home" class="px-1 py-2 hover:text-violet-400">Next Up</a>
                <a href="/library" class="px-1 py-2 hover:text-violet-400">Library</a>
                <a href="/lists" class="px-1 py-2 hover:text-violet-400">Lists</a>
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
                  Join the beta
                </a>
              </>
            )}
          </div>
        </div>
      </nav>
      {user && <BottomNav />}
      <main id="main" class={`mx-auto max-w-6xl px-4 py-6 xl:max-w-7xl${user ? " max-sm:pb-24" : ""}`}>{children}</main>
      <footer class="mt-16 border-t border-slate-800 py-8 text-sm text-slate-400">
        <div class="mx-auto max-w-6xl space-y-3 px-4 xl:max-w-7xl">
          <p>
            WatchDeck — web-first TV & movie tracking, free while in beta. <a href="/import" class="text-violet-400 underline underline-offset-2">Import from TV Time</a>.
          </p>
          <p>
            Data by{" "}
            <a href="https://www.themoviedb.org/" rel="noopener" class="text-violet-400 underline underline-offset-2">
              TMDB
            </a>
            . This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
          <p>
            <a href="/about" class="hover:underline">About & Press</a> · <a href="/guides" class="hover:underline">Guides</a> · <a href="/pricing" class="hover:underline">Pricing</a> · <a href="/privacy" class="hover:underline">Privacy</a> · <a href="/terms" class="hover:underline">Terms</a>
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
    <section class="hero-cinema -mx-4 rounded-b-3xl px-4 py-14 text-center">
      <p class="rise-in mb-3 inline-block rounded-full border border-violet-700 bg-violet-950/60 px-3 py-1 text-xs text-violet-300">
        TV Time shut down July 15 — your data still has a home
      </p>
      <h1 class="rise-in mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
        Drop in your TV Time export.
        <br />
        <span class="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
          Be back on your next episode in 30 seconds.
        </span>
      </h1>
      <p class="mx-auto mt-4 max-w-xl text-slate-400">
        Your show is back after two years. You remember loving it — not much else. WatchDeck remembers everything:
        every episode, every movie, every rating. Web-first, no app required, and every feature is free during the beta.
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <a href="/signup" class="rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-500">
          Import my TV Time data
        </a>
        <a href="/browse" class="rounded-xl border border-slate-700 px-6 py-3 font-semibold hover:border-slate-500">
          Browse shows
        </a>
      </div>
      <p class="mt-6 text-sm text-slate-500">
        No app to install · No ads · Your data exports any time · <a href="/pricing" class="text-violet-400 hover:underline">Free while in beta</a>
      </p>
    </section>
    <section class="py-10">
      <h2 class="mb-6 text-center text-2xl font-bold">Up and running in three steps</h2>
      <ol class="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
        {[
          ["1", "Bring your history", "Upload your TV Time GDPR ZIP (or a Trakt/Serializd/Netflix CSV) — or just search and add your first show."],
          ["2", "Pick up where you left off", "Next Up shows exactly which episode is next for every show, with one-tap ✓ Watched."],
          ["3", "Enjoy the extras", "Airing calendar with reminders, watch statistics, shareable lists and your year-end Wrapped."],
        ].map(([n, h, p]) => (
          <li class="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 font-bold text-white">{n}</span>
            <h3 class="mb-1 mt-3 font-semibold">{h}</h3>
            <p class="text-sm text-slate-400">{p}</p>
          </li>
        ))}
      </ol>
    </section>
    <section class="grid gap-6 py-10 sm:grid-cols-3">
      {[
        ["📦 One-click TV Time import", "Upload the GDPR ZIP as-is. We match shows, episodes, movies and ratings — nothing left behind."],
        ["▶️ Next-episode first", "Your home screen is simply what to watch next, with an episodes-left badge for every show."],
        ["🗓️ Never miss an airing", "A clean calendar of upcoming episodes and releases, with iCal feeds and email reminders."],
        ["📊 Your watch life, quantified", "Hours watched, top genres, by-year history and your ratings distribution — shareable as a public stats card."],
        ["🔀 More than one way in", "Also imports Trakt- and Serializd-style CSVs and Netflix viewing history — with a confirmation step before anything is written."],
        ["🔓 Your data stays yours", "Download everything as JSON or CSV whenever you like, and delete your account in one click. No lock-in, ever."],
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
          Almost there — check your inbox and confirm your subscription. 💌
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
    "How much does WatchDeck cost?",
    "WatchDeck is in beta, and during the beta every feature — tracking, importing, statistics, the calendar, iCal feeds and email reminders — is free for everyone. Paid Plus plans (from $1.99/month) will arrive after the beta; see the Pricing page for details. Beta members are not charged anything.",
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

const GuideLayout: FC<PropsWithChildren<{ title: string; updated: string }>> = ({ title, updated, children }) => (
  <article class="mx-auto max-w-2xl space-y-4 text-slate-300">
    <p class="text-sm">
      <a href="/guides" class="text-violet-400 underline underline-offset-2">Guides</a> <span class="text-slate-500">/</span>
    </p>
    <h1 class="text-2xl font-bold text-white">{title}</h1>
    <p class="text-sm text-slate-400">Last updated: {updated}</p>
    {children}
    <p class="rounded-2xl border border-violet-900/60 bg-violet-950/30 p-5">
      Ready to try it? <a href="/signup" class="font-medium text-violet-400 underline underline-offset-2">Join the WatchDeck beta</a> — every
      feature is free while the beta lasts, and your data exports back out any time.
    </p>
  </article>
);

export const GUIDES: { slug: string; title: string; description: string; body: FC }[] = [
  {
    slug: "export-tv-time-data",
    title: "How to export your TV Time data (and what's inside the ZIP)",
    description: "Step-by-step: requesting the TV Time GDPR export, what the ZIP contains, and how to bring your full watch history to WatchDeck.",
    body: () => (
      <>
        <h2 class="text-lg font-semibold text-white">Getting the export</h2>
        <p>
          TV Time provided data exports under GDPR: an email to their support (or the in-app privacy request while the
          service was live) returned a ZIP with your complete account data. If you requested one before the shutdown,
          that ZIP is all you need — don't unpack or edit it.
        </p>
        <h2 class="text-lg font-semibold text-white">What's inside</h2>
        <p>
          The ZIP contains CSVs including <code class="text-violet-300">tracking-prod-records</code> (episodes you watched, with timestamps),
          seen movies, your followed shows and your ratings. Episode rows reference shows by name and by TVDB-style IDs;
          movie rows carry titles and watch dates. Ratings appear for both shows and episodes.
        </p>
        <h2 class="text-lg font-semibold text-white">Importing it into WatchDeck</h2>
        <p>
          On the <a href="/import" class="text-violet-400 underline underline-offset-2">Import page</a>, upload the ZIP as-is. WatchDeck parses the CSVs,
          matches shows/episodes/movies against TMDB, shows you exactly what it found, and only writes after you confirm.
          Anything it can't match automatically is listed for one-click manual binding — nothing is silently dropped.
          Afterwards your <a href="/home" class="text-violet-400 underline underline-offset-2">Next Up</a> screen picks up from the exact episode you left off.
        </p>
        <p>
          Also importable: Trakt- and Serializd-style CSVs and Netflix viewing history — see{" "}
          <a href="/guides/import-netflix-history" class="text-violet-400 underline underline-offset-2">importing your Netflix history</a>.
        </p>
      </>
    ),
  },
  {
    slug: "tv-time-alternatives",
    title: "TV Time alternatives in 2026: an honest comparison",
    description: "TV Time shut down — here's how Trakt, Hobi, Showly, Simkl and WatchDeck compare for episode tracking, imports and price.",
    body: () => (
      <>
        <p>
          TV Time's shutdown left its users choosing a new tracker. The right one depends on what you need; here's a
          fair rundown (we build WatchDeck, and we'll say so where it matters).
        </p>
        <h2 class="text-lg font-semibold text-white">Trakt</h2>
        <p>
          The most established tracker with a huge ecosystem and media-center integrations. Web + apps. The free tier is
          ad-supported and gates several features (year in review, monthly stats, unlimited lists) behind VIP.
          TV Time imports are possible but historically lossy around episode-level data.
        </p>
        <h2 class="text-lg font-semibold text-white">Hobi & Showly</h2>
        <p>
          Polished mobile apps; Hobi positioned itself as a TV Time migration destination. Both are phone-first —
          if you want to track from a laptop or any browser, neither offers a full web experience.
        </p>
        <h2 class="text-lg font-semibold text-white">Simkl</h2>
        <p>Broad scope (TV, anime, movies) with apps and a web UI; the interface is dense and some features are premium.</p>
        <h2 class="text-lg font-semibold text-white">WatchDeck (that's us)</h2>
        <p>
          Web-first and built specifically around the TV Time export: upload the GDPR ZIP unchanged and episodes, movies
          and ratings all come across, with a confirmation step and manual binding for edge cases. Next-episode home
          screen, airing <a href="/calendar" class="text-violet-400 underline underline-offset-2">calendar</a> with iCal + email reminders,{" "}
          <a href="/stats" class="text-violet-400 underline underline-offset-2">stats</a>, shareable lists and a year-end Wrapped.
          Every feature is <a href="/pricing" class="text-violet-400 underline underline-offset-2">free while in beta</a>, with full JSON/CSV export always.
        </p>
        <p>
          Whichever you pick: get your data in writing. A tracker worth your history lets you export it back out —{" "}
          <a href="/guides/export-tv-time-data" class="text-violet-400 underline underline-offset-2">start from your TV Time ZIP</a>.
        </p>
      </>
    ),
  },
  {
    slug: "import-netflix-history",
    title: "How to import your Netflix viewing history",
    description: "Download ViewingActivity.csv from Netflix and turn years of viewing into a tracked library in one upload.",
    body: () => (
      <>
        <h2 class="text-lg font-semibold text-white">Getting the file from Netflix</h2>
        <p>
          Netflix lets each profile download its full viewing history: Account → Profiles → Viewing activity →
          "Download all". You get <code class="text-violet-300">ViewingActivity.csv</code> — two columns, title and date, going back years.
        </p>
        <h2 class="text-lg font-semibold text-white">What WatchDeck does with it</h2>
        <p>
          Upload the CSV on the <a href="/import" class="text-violet-400 underline underline-offset-2">Import page</a>. Series rows (Netflix formats them as
          "Show: Season: Episode") add the show to your library; movie rows are marked watched with their date. As with
          every import, you see the matched list first and confirm before anything is written, and unmatched titles can
          be bound manually.
        </p>
        <h2 class="text-lg font-semibold text-white">Tips</h2>
        <p>
          Import your <a href="/guides/export-tv-time-data" class="text-violet-400 underline underline-offset-2">TV Time export</a> first if you have one —
          it carries episode-level history that Netflix's file lacks, and the Netflix import then fills gaps like
          movies you only watched there. Afterwards, "⇤ up to here" bulk-marking makes squaring up partial seasons fast.
        </p>
      </>
    ),
  },
];

export const GuidesIndexPage: FC = () => (
  <div class="mx-auto max-w-2xl">
    <h1 class="text-2xl font-bold text-white">Guides</h1>
    <p class="mt-2 text-slate-400">Practical guides for moving in and getting the most out of your watch history.</p>
    <ul class="mt-6 space-y-4">
      {GUIDES.map((g) => (
        <li class="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <a href={`/guides/${g.slug}`} class="font-semibold text-violet-400 underline underline-offset-2">{g.title}</a>
          <p class="mt-1 text-sm text-slate-400">{g.description}</p>
        </li>
      ))}
    </ul>
  </div>
);

export const GuidePage: FC<{ guide: (typeof GUIDES)[number] }> = ({ guide }) => (
  <GuideLayout title={guide.title} updated="August 5, 2026">
    <guide.body />
  </GuideLayout>
);

export const AuthForm: FC<{ mode: "login" | "signup"; error?: string; next?: string }> = ({ mode, error, next }) => (
  <div class="mx-auto max-w-sm py-10">
    <h1 class="mb-6 text-2xl font-bold">{mode === "login" ? "Log in" : "Create your account"}</h1>
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
        {mode === "signup" && (
          <p id="pw-hint" class="mt-1.5 hidden text-xs" aria-live="polite"></p>
        )}
      </div>
      <button class="w-full rounded-lg bg-violet-600 py-2.5 font-semibold text-white hover:bg-violet-500">
        {mode === "login" ? "Log in" : "Sign up"}
      </button>
      {mode === "signup" && (
        <p class="text-xs text-slate-500">
          We only email you for things you ask for — a welcome note, password resets, and reminders you switch on. No marketing without consent.
        </p>
      )}
    </form>
    <p class="mt-4 text-sm text-slate-400">
      {mode === "login" ? (
        <>No account? <a href="/signup" class="text-violet-400 hover:underline">Sign up</a> · <a href="/forgot" class="text-violet-400 hover:underline">Forgot password?</a></>
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
        class="aspect-[2/3] w-full rounded-xl border object-cover poster-fx"
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
  episodesLeft: number;
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
  hasWatch?: boolean;
  wrappedYear?: number;
  streak?: number;
}> = ({ nextUp, watchlistCount, hasAnything, justWatched, watchlistPreview, upcoming, hasWatch, wrappedYear, streak }) => (
  <div>
    <h1 class="mb-6 text-2xl font-bold">Next up</h1>
    {!(hasAnything && hasWatch) && (
      <section data-dismiss-key="onboarding-v1" hidden class="mb-6 rounded-2xl border border-violet-900/60 bg-violet-950/30 p-5" aria-label="Getting started checklist">
        <div class="flex items-start justify-between gap-3">
          <h2 class="font-semibold">Getting started</h2>
          <button data-dismiss class="rounded px-2 text-slate-400 hover:text-slate-200" aria-label="Dismiss getting started checklist">✕</button>
        </div>
        <ol class="mt-3 space-y-2 text-sm">
          <li class="flex items-center gap-2">
            <span aria-hidden="true">{hasAnything ? "✅" : "1️⃣"}</span>
            <span class={hasAnything ? "text-slate-500 line-through" : ""}>
              Add your shows — <a href="/import" class="text-violet-400 hover:underline">import your TV Time export</a> or{" "}
              <a href="/search" class="text-violet-400 hover:underline">search for one</a>
            </span>
          </li>
          <li class="flex items-center gap-2">
            <span aria-hidden="true">{hasWatch ? "✅" : "2️⃣"}</span>
            <span class={hasWatch ? "text-slate-500 line-through" : ""}>Mark your first episode watched — Next Up keeps your place from there</span>
          </li>
          <li class="flex items-center gap-2">
            <span aria-hidden="true">3️⃣</span>
            <span>
              Explore the extras — <a href="/calendar" class="text-violet-400 hover:underline">calendar</a>,{" "}
              <a href="/stats" class="text-violet-400 hover:underline">stats</a> and{" "}
              <a href="/wrapped" class="text-violet-400 hover:underline">your Wrapped</a>
            </span>
          </li>
        </ol>
      </section>
    )}
    {hasAnything && hasWatch && wrappedYear != null && (
      <div data-dismiss-key={`wrapped-${wrappedYear}`} hidden class="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-violet-900/60 bg-violet-950/30 px-4 py-2.5 text-sm">
        <span>✨ New: your {wrappedYear} Wrapped is ready — <a href={`/wrapped/${wrappedYear}`} class="font-medium text-violet-300 hover:underline">see your year in TV & film</a></span>
        <button data-dismiss class="ml-auto rounded px-2 text-slate-400 hover:text-slate-200" aria-label="Dismiss Wrapped announcement">✕</button>
      </div>
    )}
    {(streak ?? 0) >= 2 && (
      <a href="/stats" class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-900/60 bg-orange-950/30 px-4 py-2.5 text-sm hover:border-orange-700">
        <span class="text-orange-300">
          🔥 <span class="stat-num font-semibold">{streak}-day</span> watching streak
        </span>
        <span class="text-xs text-slate-400">Watch anything today to keep it going →</span>
      </a>
    )}
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
                        class="aspect-[2/3] w-full rounded-xl border object-cover poster-fx"
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
              <p class="text-xs text-slate-400">
                {n.airDate ? `aired ${n.airDate}` : ""}
                {n.episodesLeft > 1 ? `${n.airDate ? " · " : ""}${n.episodesLeft} eps left` : ""}
              </p>
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
              {it.mediaType === "tv" && it.episode === 1 && (
                <span class="shrink-0 rounded-full border border-violet-800 bg-violet-950/50 px-2 py-0.5 text-xs font-medium text-violet-300">
                  {it.season === 1 ? "Series premiere" : "Season premiere"}
                </span>
              )}
              {it.mediaType === "tv" && it.episode !== 1 && it.episodeType === "finale" && (
                <span class="shrink-0 rounded-full border border-amber-800 bg-amber-950/50 px-2 py-0.5 text-xs font-medium text-amber-300">
                  Season finale
                </span>
              )}
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

export const SearchPage: FC<{ q: string; results: SearchResult[]; libraryIds?: Set<string>; type?: "all" | "tv" | "movie" | "person"; loggedIn?: boolean }> = ({ q, results, libraryIds, type = "all", loggedIn }) => {
  const backTo = `/search?q=${encodeURIComponent(q)}${type === "all" ? "" : `&type=${type}`}`;
  const filtered = results.filter((r) => (r.media_type === "tv" || r.media_type === "movie") && (type === "all" || r.media_type === type));
  const people =
    type === "all" || type === "person"
      ? results.filter((r) => r.media_type === "person" && r.profile_path).slice(0, type === "person" ? 20 : 8)
      : [];
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
              ["person", "People"],
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
      {people.length > 0 && (
        <div class="mb-8">
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">People</h2>
          <ul class="flex flex-wrap gap-4">
            {people.map((p) => (
              <li class="w-20 text-center">
                <a href={`/person/${p.id}-${slugify(p.name ?? "")}`} class="group block">
                  <img
                    src={`https://image.tmdb.org/t/p/w185${p.profile_path}`}
                    alt={p.name}
                    loading="lazy"
                    class="mx-auto aspect-square w-16 rounded-full border border-slate-800 object-cover"
                  />
                  <p class="mt-1.5 line-clamp-2 text-xs group-hover:text-violet-400">{p.name}</p>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 stagger-in">
        {filtered.map((r) => {
          const inLib = libraryIds?.has(`${r.media_type}:${r.id}`);
          return (
            <div>
              <MediaCard item={r} type={r.media_type as "tv" | "movie"} inLibrary={inLib} />
              {loggedIn && !inLib && (
                <form action="/api/track" method="post" class="mt-1.5">
                  <input type="hidden" name="tmdb_id" value={String(r.id)} />
                  <input type="hidden" name="media_type" value={r.media_type} />
                  <input type="hidden" name="status" value="watchlist" />
                  <input type="hidden" name="redirect" value={backTo} />
                  <button class="w-full rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-violet-500 hover:text-violet-300">
                    + Watchlist
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
      {q && filtered.length === 0 && people.length === 0 && (
        <EmptyState title="Nothing found">
          {type !== "all"
            ? `No ${type === "tv" ? "TV shows" : type === "movie" ? "movies" : "people"} matched — try the All tab.`
            : "Check the spelling, or browse what's trending below."}
        </EmptyState>
      )}
    </div>
  );
};

export const TrendingSection: FC<{ shows: SearchResult[]; movies: SearchResult[] }> = ({ shows, movies }) => (
  <div class="space-y-10">
    <section>
      <h2 class="mb-4 text-xl font-semibold">Trending shows this week</h2>
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 stagger-in">
        {shows.slice(0, 12).map((s) => (
          <MediaCard item={s} type="tv" />
        ))}
      </div>
    </section>
    <section>
      <h2 class="mb-4 text-xl font-semibold">Trending movies this week</h2>
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 stagger-in">
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
            <a href={`/person/${m.id}-${slugify(m.name)}`} class="group block">
              <img
                src={m.profile_path ? `https://image.tmdb.org/t/p/w185${m.profile_path}` : "/placeholder-poster.svg"}
                alt={m.name}
                loading="lazy"
                class="mx-auto aspect-[2/3] w-full max-w-[7rem] rounded-xl border border-slate-800 object-cover"
              />
              <p class="mt-2 line-clamp-1 text-sm font-medium group-hover:text-violet-400">{m.name}</p>
            </a>
            {m.character && <p class="line-clamp-1 text-xs text-slate-400">{m.character}</p>}
          </li>
        ))}
      </ul>
    </div>
  );

export const PersonPage: FC<{ person: PersonDetails; credits: PersonCredit[] }> = ({ person, credits }) => (
  <div>
    <div class="flex flex-col gap-6 sm:flex-row">
      <img
        src={person.profile_path ? `https://image.tmdb.org/t/p/w342${person.profile_path}` : "/placeholder-poster.svg"}
        alt={person.name}
        fetchpriority="high"
        class="aspect-[2/3] w-40 self-start rounded-xl border border-slate-800 object-cover sm:w-52"
      />
      <div class="min-w-0 flex-1">
        <h1 class="text-3xl font-bold">{person.name}</h1>
        <p class="mt-1 text-sm text-slate-400">
          {person.known_for_department ?? "Acting"}
          {person.birthday ? ` · born ${person.birthday}` : ""}
        </p>
        {person.biography && <p class="mt-4 line-clamp-[8] max-w-2xl whitespace-pre-line text-slate-300">{person.biography}</p>}
      </div>
    </div>
    {(
      [
        ["TV shows", credits.filter((cr) => cr.media_type === "tv")],
        ["Movies", credits.filter((cr) => cr.media_type === "movie")],
      ] as const
    ).map(
      ([label, group]) =>
        group.length > 0 && (
          <div class="mt-12">
            <h2 class="mb-4 text-xl font-semibold">{label}</h2>
            <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 stagger-in">
              {group.map((cr) => {
                const title = cr.title ?? cr.name ?? "";
                return (
                  <a href={`/${cr.media_type === "tv" ? "shows" : "movies"}/${cr.id}-${slugify(title)}`} class="poster-card group block">
                    <img
                      src={poster(cr.poster_path)}
                      alt={title}
                      loading="lazy"
                      class="aspect-[2/3] w-full rounded-xl border border-slate-800 object-cover"
                    />
                    <p class="mt-2 line-clamp-1 text-sm font-medium group-hover:text-violet-400">{title}</p>
                    {cr.character && <p class="line-clamp-1 text-xs text-slate-400">as {cr.character}</p>}
                  </a>
                );
              })}
            </div>
          </div>
        )
    )}
  </div>
);

export const RecsSection: FC<{ recs: SearchResult[]; type: "tv" | "movie" }> = ({ recs, type }) =>
  recs.length === 0 ? null : (
    <div class="mt-12">
      <h2 class="mb-4 text-xl font-semibold">More like this</h2>
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 stagger-in">
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

export const EmptyState: FC<PropsWithChildren<{ title: string; cta?: { href: string; label: string } }>> = ({ title, cta, children }) => (
  <div class="mx-auto max-w-md rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 px-6 py-10 text-center">
    <svg viewBox="0 0 96 72" width="96" height="72" aria-hidden="true" class="mx-auto mb-4 opacity-90">
      <defs>
        <linearGradient id="esg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#8b5cf6" />
          <stop offset="1" stop-color="#d946ef" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="66" rx="30" ry="4" fill="#1e293b" />
      <rect x="24" y="26" width="48" height="34" rx="4" fill="#0f172a" stroke="#334155" />
      <path d="M24 30a4 4 0 0 1 4-4h44a4 4 0 0 1 4 4v8H24z" fill="url(#esg)" transform="rotate(-8 24 34)" />
      <path d="M30 22l6 8m8-10l6 8m8-10l6 8" stroke="#020617" stroke-width="2" transform="rotate(-8 24 34)" />
      <path d="M44 40l12 7-12 7z" fill="#e2e8f0" />
    </svg>
    <p class="font-semibold text-slate-200">{title}</p>
    <p class="mt-1 text-sm text-slate-400">{children}</p>
    {cta && (
      <a href={cta.href} class="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
        {cta.label}
      </a>
    )}
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

export const WhereToWatch: FC<{ providers: WatchProviders | null; mine?: Set<number> }> = ({ providers, mine }) =>
  !providers?.flatrate?.length ? null : (
    <div class="mt-4">
      <p class="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        Where to stream (US)
        {mine?.size && providers.flatrate.some((p) => mine.has(p.provider_id)) ? <span class="ml-2 normal-case tracking-normal text-emerald-400">✓ On your services</span> : null}
      </p>
      <div class="flex flex-wrap items-center gap-2">
        {providers.flatrate.slice(0, 6).map((p) => (
          <a href={providers.link} rel="noopener" title={mine?.has(p.provider_id) ? `On your service: ${p.provider_name}` : `Stream on ${p.provider_name}`} class="block">
            <img
              src={`https://image.tmdb.org/t/p/w45${p.logo_path}`}
              alt={p.provider_name}
              width={32}
              height={32}
              loading="lazy"
              class={mine?.has(p.provider_id) ? "rounded-lg border-2 border-emerald-500" : "rounded-lg border border-slate-800"}
            />
          </a>
        ))}
        <span class="text-xs text-slate-400">
          data by <a href="https://www.justwatch.com/" rel="noopener" class="hover:underline">JustWatch</a>
        </span>
      </div>
    </div>
  );

export const AddToList: FC<{ lists: ListRef[]; tmdbId: number; mediaType: "tv" | "movie"; title: string; posterPath: string | null; redirect: string }> = ({ lists, tmdbId, mediaType, title, posterPath, redirect }) => (
  <details class="relative">
    <summary class="cursor-pointer list-none rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:border-violet-500">☰ Lists</summary>
    <div class="absolute z-30 mt-1 w-56 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl">
      {lists.length === 0 && (
        <p class="px-2 py-1 text-xs text-slate-400">
          No lists yet. <a href="/lists" class="text-violet-400 hover:underline">Create one →</a>
        </p>
      )}
      {lists.map((l) => (
        <form action={l.has ? "/api/lists/remove" : "/api/lists/add"} method="post">
          <input type="hidden" name="list_id" value={String(l.id)} />
          <input type="hidden" name="tmdb_id" value={String(tmdbId)} />
          <input type="hidden" name="media_type" value={mediaType} />
          <input type="hidden" name="title" value={title} />
          <input type="hidden" name="poster_path" value={posterPath ?? ""} />
          <input type="hidden" name="redirect" value={redirect} />
          <button class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-800">
            <span class={l.has ? "text-emerald-400" : "text-slate-500"}>{l.has ? "✓" : "+"}</span>
            <span class="line-clamp-1">{l.name}</span>
          </button>
        </form>
      ))}
      {lists.length > 0 && (
        <a href="/lists" class="block px-2 py-1.5 text-xs text-violet-400 hover:underline">Manage lists →</a>
      )}
    </div>
  </details>
);

const StatusBadge: FC<{ status: string }> = ({ status }) => {
  const cls =
    status === "Returning Series" || status === "In Production" || status === "Planned"
      ? "border-emerald-800 bg-emerald-950/50 text-emerald-300"
      : status === "Canceled"
        ? "border-red-900 bg-red-950/50 text-red-300"
        : "border-slate-700 bg-slate-900/60 text-slate-300";
  return <span class={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
};

export const ShowPage: FC<{
  show: TvDetails;
  season: SeasonDetails | null;
  watched: Set<string>;
  plays?: Map<string, number>;
  epRatings?: Map<string, number>;
  tracked: { status: string; rating: number | null; notes: string | null } | null;
  user: User | null;
  recs: SearchResult[];
  providers?: WatchProviders | null;
  cast?: CastMember[];
  trailer?: string | null;
  myServices?: Set<number>;
  lists?: ListRef[];
}> = ({ show, season, watched, plays, epRatings, tracked, user, recs, providers, cast, trailer, myServices, lists }) => {
  const showUrl = `/shows/${show.id}-${slugify(show.name)}`;
  return (
    <div>
      <div class="backdrop-hero flex flex-col gap-6 rounded-3xl p-4 sm:flex-row sm:p-6">
        {show.backdrop_path && (
          <div class="backdrop-img" aria-hidden="true">
            <img src={`https://image.tmdb.org/t/p/w1280${show.backdrop_path}`} alt="" loading="eager" fetchpriority="low" />
          </div>
        )}
        <img src={poster(show.poster_path)} alt={show.name} fetchpriority="high" class="rise-in aspect-[2/3] w-40 self-start rounded-xl border border-slate-800 object-cover shadow-2xl shadow-slate-950/60 sm:w-52" />
        <div class="min-w-0 flex-1">
          <h1 class="text-3xl font-bold">{show.name}</h1>
          <p class="mt-1 text-sm text-slate-400">
            {show.first_air_date?.slice(0, 4)} · {show.number_of_seasons} season{show.number_of_seasons === 1 ? "" : "s"} ·{" "}
            {show.number_of_episodes} episodes · <StatusBadge status={show.status} /> · ★ {show.vote_average?.toFixed(1)}
          </p>
          {(show.created_by?.length ?? 0) > 0 && (
            <p class="mt-1 text-sm text-slate-400">
              Created by{" "}
              {show.created_by!.map((p, i) => (
                <>
                  {i > 0 && ", "}
                  <a href={`/person/${p.id}-${slugify(p.name)}`} class="text-violet-400 hover:underline">{p.name}</a>
                </>
              ))}
            </p>
          )}
          <p class="mt-1 text-sm text-slate-400">
            {show.genres.map((g) => g.name).join(", ")}
            {trailer && (
              <>
                {" · "}
                <a href={trailer} rel="noopener" target="_blank" class="text-violet-400 hover:underline">▶ Trailer</a>
              </>
            )}
          </p>
          {show.next_episode_to_air?.air_date && (
            <p class="mt-3 inline-block rounded-lg border border-violet-800 bg-violet-950/50 px-3 py-1.5 text-sm text-violet-300">
              {show.next_episode_to_air.air_date < new Date().toISOString().slice(0, 10) ? "New episode aired" : "Next episode"}: S
              {String(show.next_episode_to_air.season_number).padStart(2, "0")}E
              {String(show.next_episode_to_air.episode_number).padStart(2, "0")}
              {show.next_episode_to_air.name ? ` — ${show.next_episode_to_air.name}` : ""} ·{" "}
              {show.next_episode_to_air.air_date === new Date().toISOString().slice(0, 10)
                ? "today"
                : new Date(show.next_episode_to_air.air_date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
            </p>
          )}
          <p class="mt-4 max-w-2xl text-slate-300">{show.overview}</p>
          <WhereToWatch providers={providers ?? null} mine={myServices} />
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
                        ? "rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white shadow-lg shadow-violet-950/50"
                        : !tracked && s === "watching"
                          ? "rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/50 hover:bg-violet-500"
                          : "rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-violet-500"
                    }
                  >
                    {s === "watching" ? (tracked ? "▶ Watching" : "▶ Start watching") : s === "watchlist" ? "+ Watchlist" : s === "completed" ? "✓ Completed" : "✕ Dropped"}
                  </button>
                </form>
              ))}
              <AddToList lists={lists ?? []} tmdbId={show.id} mediaType="tv" title={show.name} posterPath={show.poster_path} redirect={showUrl} />
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
              <a href={`/signup?next=${encodeURIComponent(showUrl)}`} class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">Track this show — free in beta</a>
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
                  <span
                    class={`ml-1.5 text-xs ${
                      s.episode_count > 0 && seen >= s.episode_count
                        ? season?.season_number === s.season_number
                          ? "text-emerald-100"
                          : "text-emerald-300"
                        : season?.season_number === s.season_number
                          ? "text-violet-100"
                          : "text-slate-300"
                    }`}
                  >
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
          const seen = aired.filter((ep) => watched.has(`${ep.season_number}x${ep.episode_number}`)).length;
          return (
            <>
            {aired.length > 0 && (
              <div class="mb-3 flex items-center gap-3">
                <div class="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-800">
                  <div
                    id="season-progress-bar"
                    class="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
                    style={`width:${Math.round((100 * seen) / aired.length)}%`}
                    data-seen={String(seen)}
                    data-total={String(aired.length)}
                  />
                </div>
                <span id="season-progress-text" class="stat-num shrink-0 text-xs text-slate-400">{seen}/{aired.length} aired watched</span>
              </div>
            )}
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
            </>
          );
        })()}
        {season && (
          <ul class="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800">
            {season.episodes.map((ep) => {
              const isWatched = watched.has(`${ep.season_number}x${ep.episode_number}`);
              const playCount = plays?.get(`${ep.season_number}x${ep.episode_number}`) ?? 1;
              const epRating = epRatings?.get(`${ep.season_number}x${ep.episode_number}`);
              return (
                <li class="flex flex-wrap items-center gap-x-4 gap-y-2 bg-slate-900/40 px-4 py-3">
                  <span class="w-14 shrink-0 text-sm text-slate-400">
                    S{String(ep.season_number).padStart(2, "0")}E{String(ep.episode_number).padStart(2, "0")}
                  </span>
                  <div class="min-w-0 flex-1 basis-40">
                    <p class="line-clamp-1 font-medium">{ep.name}</p>
                    <p class="whitespace-nowrap text-xs text-slate-400">{ep.air_date ?? "TBA"}</p>
                  </div>
                  {user && (
                    <div class="ml-auto flex shrink-0 items-center gap-2">
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
                      {isWatched && (
                        <form action="/api/episode-rating" method="post">
                          <input type="hidden" name="tmdb_id" value={String(show.id)} />
                          <input type="hidden" name="season" value={String(ep.season_number)} />
                          <input type="hidden" name="episode" value={String(ep.episode_number)} />
                          <input type="hidden" name="redirect" value={`${showUrl}?season=${season.season_number}`} />
                          <select
                            name="rating"
                            data-autosubmit
                            aria-label={`Rate season ${ep.season_number} episode ${ep.episode_number}`}
                            class={epRating ? "rounded-lg border border-slate-700 bg-slate-900 px-1.5 py-1 text-sm text-amber-300" : "rounded-lg border border-slate-700 bg-slate-900 px-1.5 py-1 text-sm text-slate-400"}
                          >
                            <option value="" selected={!epRating}>☆ rate</option>
                            {[5, 4, 3, 2, 1].map((n) => (
                              <option value={String(n)} selected={epRating === n}>{"★".repeat(n)}</option>
                            ))}
                          </select>
                        </form>
                      )}
                      {isWatched && (
                        <form action="/api/watch-again" method="post">
                          <input type="hidden" name="tmdb_id" value={String(show.id)} />
                          <input type="hidden" name="season" value={String(ep.season_number)} />
                          <input type="hidden" name="episode" value={String(ep.episode_number)} />
                          <input type="hidden" name="redirect" value={`${showUrl}?season=${season.season_number}`} />
                          <button
                            class="rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:text-violet-300"
                            title="Watched this episode again"
                            aria-label={`Log a rewatch of season ${ep.season_number} episode ${ep.episode_number}`}
                          >
                            ↺ again
                          </button>
                        </form>
                      )}
                      <form action="/api/watch" method="post" data-ep-watch data-ep-label={`S${String(ep.season_number).padStart(2, "0")}E${String(ep.episode_number).padStart(2, "0")}`}>
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
                          {isWatched ? (playCount > 1 ? `✓ Watched ${playCount}\u00d7` : "✓ Watched") : "Mark watched"}
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
  watchCount: number;
  tracked: { status: string; rating: number | null; notes: string | null } | null;
  user: User | null;
  recs: SearchResult[];
  providers?: WatchProviders | null;
  cast?: CastMember[];
  trailer?: string | null;
  myServices?: Set<number>;
  lists?: ListRef[];
  directors?: { id: number; name: string }[];
}> = ({ movie, watchCount, tracked, user, recs, providers, cast, trailer, myServices, lists, directors }) => {
  const movieUrl = `/movies/${movie.id}-${slugify(movie.title)}`;
  const watched = watchCount > 0;
  return (
    <div>
    <div class="backdrop-hero flex flex-col gap-6 rounded-3xl p-4 sm:flex-row sm:p-6">
      {movie.backdrop_path && (
        <div class="backdrop-img" aria-hidden="true">
          <img src={`https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`} alt="" loading="eager" fetchpriority="low" />
        </div>
      )}
      <img src={poster(movie.poster_path)} alt={movie.title} fetchpriority="high" class="rise-in aspect-[2/3] w-40 self-start rounded-xl border border-slate-800 object-cover shadow-2xl shadow-slate-950/60 sm:w-52" />
      <div class="min-w-0 flex-1">
        <h1 class="text-3xl font-bold">{movie.title}</h1>
        <p class="mt-1 text-sm text-slate-400">
          {movie.release_date?.slice(0, 4)} {movie.runtime ? `· ${movie.runtime} min` : ""} · ★ {movie.vote_average?.toFixed(1)}
        </p>
        {(directors?.length ?? 0) > 0 && (
          <p class="mt-1 text-sm text-slate-400">
            Directed by{" "}
            {directors!.map((p, i) => (
              <>
                {i > 0 && ", "}
                <a href={`/person/${p.id}-${slugify(p.name)}`} class="text-violet-400 hover:underline">
                  {p.name}
                </a>
              </>
            ))}
          </p>
        )}
        <p class="mt-1 text-sm text-slate-400">
          {movie.genres.map((g) => g.name).join(", ")}
          {trailer && (
            <>
              {" · "}
              <a href={trailer} rel="noopener" target="_blank" class="text-violet-400 hover:underline">▶ Trailer</a>
            </>
          )}
        </p>
        <p class="mt-4 max-w-2xl text-slate-300">{movie.overview}</p>
        <WhereToWatch providers={providers ?? null} mine={myServices} />
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
                {watched ? (watchCount > 1 ? `✓ Watched ${watchCount}×` : "✓ Watched") : "Mark watched"}
              </button>
            </form>
            {watched && (
              <form action="/api/watch-movie" method="post">
                <input type="hidden" name="tmdb_id" value={String(movie.id)} />
                <input type="hidden" name="rewatch" value="1" />
                <input type="hidden" name="redirect" value={movieUrl} />
                <button class="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:border-violet-500" title="Log another watch of this movie">
                  ↺ Watched again
                </button>
              </form>
            )}
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
            <AddToList lists={lists ?? []} tmdbId={movie.id} mediaType="movie" title={movie.title} posterPath={movie.poster_path} redirect={movieUrl} />
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
            <a href={`/signup?next=${encodeURIComponent(movieUrl)}`} class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">Track this movie — free in beta</a>
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

export const LibraryPage: FC<{ rows: LibraryRow[]; status: string; sort: string; q?: string; counts?: Record<string, number>; page?: number; lastPage?: number; avail?: boolean; hasServices?: boolean; availCapped?: boolean }> = ({ rows, status, sort, q, counts, page = 1, lastPage = 1, avail, hasServices, availCapped }) => (
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
          ["rating", "Top rated"],
        ] as const
      ).map(([key, label]) => (
        <a
          href={`/library?${status === "all" ? "" : `status=${status}&`}sort=${key}`}
          class={sort === key ? "rounded-lg bg-slate-700 px-2.5 py-1 text-white" : "rounded-lg px-2.5 py-1 text-slate-400 hover:text-slate-200"}
        >
          {label}
        </a>
      ))}
      {hasServices && (
        <a
          href={`/library?${status === "all" ? "" : `status=${status}&`}sort=${sort}${q ? `&q=${encodeURIComponent(q)}` : ""}${avail ? "" : "&avail=mine"}`}
          class={avail ? "rounded-lg bg-emerald-700 px-2.5 py-1 text-white" : "rounded-lg border border-slate-700 px-2.5 py-1 text-slate-300 hover:border-emerald-500"}
          title="Only items streamable on the services you picked in Settings"
        >
          📺 On my services
        </a>
      )}
      <a
        href="/roulette"
        class="rounded-lg border border-slate-700 px-2.5 py-1 text-slate-300 hover:border-violet-500"
        title="Jump to a random title from your watchlist"
      >
        🎲 Surprise me
      </a>
    </div>
    {avail && availCapped && (
      <p class="mb-4 text-xs text-slate-400">Availability is checked for the first 30 items on this page.</p>
    )}
    {rows.length === 0 ? (
      avail ? (
        <p class="text-slate-400">
          Nothing here is streamable on your services right now.{" "}
          <a href={`/library?${status === "all" ? "" : `status=${status}&`}sort=${sort}`} class="text-violet-400 hover:underline">Show everything</a> or{" "}
          <a href="/settings" class="text-violet-400 hover:underline">update your services</a>.
        </p>
      ) : q ? (
        <p class="text-slate-400">
          Nothing in your library matches “{q}”. <a href={`/library?${status === "all" ? "" : `status=${status}&`}sort=${sort}`} class="text-violet-400 hover:underline">Clear filter</a>
        </p>
      ) : (
      <EmptyState title="Your library is waiting" cta={{ href: "/import", label: "📦 Import from TV Time" }}>
        Or <a href="/search" class="text-violet-400 hover:underline">search</a> for your first show.
      </EmptyState>
      )
    ) : (
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 stagger-in">
        {rows.map((r) => (
          <div>
            <a href={`/${r.media_type === "tv" ? "shows" : "movies"}/${r.tmdb_id}-${slugify(r.title)}`} class="group block">
              <img
                src={poster(r.poster_path)}
                alt={r.title}
                loading="lazy"
                class="aspect-[2/3] w-full rounded-xl border object-cover poster-fx"
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
  episodeType?: string;
  airDate: string;
}

const airDateLabel = (iso: string): { label: string; today: boolean } => {
  const todayIso = new Date().toISOString().slice(0, 10);
  if (iso === todayIso) return { label: "Today", today: true };
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (iso === tomorrow) return { label: "Tomorrow", today: false };
  const date = new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const days = Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(todayIso + "T00:00:00Z")) / 86400000);
  return { label: days > 1 && days <= 30 ? `${date} · in ${days} days` : date, today: false };
};

export const CalendarPage: FC<{ items: CalendarItem[]; feedUrl: string; remindEmail: boolean }> = ({ items, feedUrl, remindEmail }) => (
  <div>
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <h1 class="text-2xl font-bold">Upcoming episodes &amp; releases</h1>
      <a href={feedUrl} class="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-violet-300 hover:border-violet-500">
        📅 Subscribe (iCal)
      </a>
      <Hint tip="iCal is a standard calendar feed: paste the link into Google or Apple Calendar once and air dates keep updating there automatically." />
      <form action="/api/feed/rotate" method="post">
        <button class="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:border-violet-500 hover:text-violet-300" title="Invalidate the current iCal URL and generate a new one">
          ↻ Reset feed URL
        </button>
      </form>
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
      <EmptyState title="No scheduled air dates right now" cta={{ href: "/browse", label: "Browse for something new" }}>
        The shows you track have no announced upcoming episodes — new dates show up here (and in your iCal feed) automatically.
      </EmptyState>
    ) : (
      <div class="space-y-6">
        {[...new Set(items.map((it) => it.airDate))].map((date) => {
          const d = airDateLabel(date);
          const dayItems = items.filter((it) => it.airDate === date);
          return (
            <section>
              <h2 class={d.today ? "mb-2 text-sm font-semibold uppercase tracking-wide text-violet-300" : "mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400"} title={date}>
                {d.label}
              </h2>
              <ul class="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800">
                {dayItems.map((it) => (
                  <li class={d.today ? "flex items-center gap-4 bg-violet-950/40 px-4 py-3" : "flex items-center gap-4 bg-slate-900/40 px-4 py-3"}>
                    <img src={poster(it.posterPath, "w92")} alt="" class="aspect-[2/3] h-14 w-auto rounded border border-slate-800 object-cover" />
                    <div class="min-w-0">
                      <a href={`/${it.mediaType === "tv" ? "shows" : "movies"}/${it.tmdbId}-${slugify(it.title)}`} class="line-clamp-1 font-medium hover:text-violet-400">
                        {it.title}
                      </a>
                      <p class="text-sm text-slate-400">
                        {it.mediaType === "tv" && it.season != null && it.episode != null
                          ? `S${String(it.season).padStart(2, "0")}E${String(it.episode).padStart(2, "0")}${it.episodeName ? ` · ${it.episodeName}` : ""}`
                          : "🎬 Movie release"}
                        {it.mediaType === "tv" && it.episode === 1 && (
                          <span class="ml-2 inline-block rounded-full border border-violet-800 bg-violet-950/50 px-2 py-0.5 text-xs font-medium text-violet-300">
                            {it.season === 1 ? "Series premiere" : "Season premiere"}
                          </span>
                        )}
                        {it.mediaType === "tv" && it.episode !== 1 && it.episodeType === "finale" && (
                          <span class="ml-2 inline-block rounded-full border border-amber-800 bg-amber-950/50 px-2 py-0.5 text-xs font-medium text-amber-300">
                            Season finale
                          </span>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    )}
  </div>
);

export const BrowseIndex: FC<{
  tvGenres: { id: number; name: string }[];
  movieGenres: { id: number; name: string }[];
  networks: readonly { id: number; name: string }[];
  years: number[];
  people?: { id: number; name: string; profile_path: string | null }[];
}> = ({ tvGenres, movieGenres, networks, years, people }) => (
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
    {people && people.length > 0 && (
      <section class="mb-10">
        <h2 class="mb-4 text-xl font-semibold">Popular people</h2>
        <ul class="flex flex-wrap gap-4">
          {people.map((p) => (
            <li class="w-20 text-center">
              <a href={`/person/${p.id}-${slugify(p.name)}`} class="group block">
                <img
                  src={`https://image.tmdb.org/t/p/w185${p.profile_path}`}
                  alt={p.name}
                  loading="lazy"
                  class="mx-auto aspect-square w-16 rounded-full border border-slate-800 object-cover"
                />
                <p class="mt-1.5 line-clamp-2 text-xs group-hover:text-violet-400">{p.name}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>
    )}
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
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 stagger-in">
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
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 stagger-in">
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
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 stagger-in">
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
  ratingCounts: number[];
  topGenres: { name: string; count: number }[];
  epsThisYear: number;
  moviesThisYear: number;
  epsThisMonth: number;
  moviesThisMonth: number;
  topShowThisMonth: { title: string; eps: number } | null;
  currentStreak: number;
  bestStreak: number;
  topEpisodes: { title: string; tmdb_id: number; season: number; episode: number; rating: number }[];
}

const StatsBody: FC<{ stats: UserStats }> = ({ stats }) => {
  const maxMonth = Math.max(1, ...stats.byMonth.map((m) => m.eps));
  return (
    <div>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          [stats.hoursWatched.toLocaleString("en-US"), "hours watched", "Estimated from each episode's and movie's real runtime — rewatches count every time you watch."],
          [String(stats.epsWatched), "episodes watched", "Unique episodes you've marked as watched, across all your shows."],
          [String(stats.moviesWatched), "movies watched", "Different movies you've logged at least once."],
          [String(stats.showsTracked), "shows tracked", "Shows in your library — watching, planning to watch, or finished."],
          [String(stats.completedShows), "shows completed", "Shows where you've seen every aired episode. Nice work."],
        ].map(([n, label, tip]) => (
          <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-center">
            <p class="stat-num text-3xl font-extrabold text-violet-300">{n}</p>
            <p class="mt-1 text-sm text-slate-400">
              {label}
              <Hint tip={tip} />
            </p>
          </div>
        ))}
      </div>
      {(stats.epsThisYear > 0 || stats.moviesThisYear > 0) && (
        <p class="mt-4 text-sm text-slate-400">
          So far in {new Date().getUTCFullYear()}: <span class="font-semibold text-violet-300">{stats.epsThisYear}</span> episode{stats.epsThisYear === 1 ? "" : "s"} and{" "}
          <span class="font-semibold text-violet-300">{stats.moviesThisYear}</span> movie{stats.moviesThisYear === 1 ? "" : "s"} watched.
          {stats.currentStreak >= 2 && (
            <>
              {" "}🔥 <span class="font-semibold text-violet-300">{stats.currentStreak}-day</span> watching streak{stats.bestStreak > stats.currentStreak ? <> (best: {stats.bestStreak} days)</> : null}.
              <Hint tip="Consecutive days with at least one episode or movie watched. Watch anything today to keep it going." />
            </>
          )}
          {stats.currentStreak < 2 && stats.bestStreak >= 2 && (
            <> Longest watching streak: <span class="font-semibold text-violet-300">{stats.bestStreak} days</span>.</>
          )}
        </p>
      )}
      {(stats.epsThisMonth > 0 || stats.moviesThisMonth > 0) && (
        <div class="mt-6 rounded-2xl border border-violet-900/60 bg-violet-950/30 p-5">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-violet-300">
            {new Date().toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })} in review
          </h2>
          <p class="mt-2 text-slate-300">
            <span class="font-semibold text-violet-300">{stats.epsThisMonth}</span> episode{stats.epsThisMonth === 1 ? "" : "s"} and{" "}
            <span class="font-semibold text-violet-300">{stats.moviesThisMonth}</span> movie{stats.moviesThisMonth === 1 ? "" : "s"} watched this month
            {stats.topShowThisMonth ? (
              <> — most watched: <span class="font-semibold text-violet-300">{stats.topShowThisMonth.title}</span> ({stats.topShowThisMonth.eps} eps)</>
            ) : null}
            .
          </p>
        </div>
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
                  <div class="bar-grow h-3 rounded bg-gradient-to-r from-violet-600 to-fuchsia-500" style={`width:${Math.max(2, Math.round((m.eps / maxMonth) * 100))}%`} />
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
                  <div class="bar-grow h-3 rounded bg-gradient-to-r from-violet-600 to-fuchsia-500" style={`width:${Math.max(2, Math.round((total / maxYear) * 100))}%`} />
                  <span class="whitespace-nowrap text-slate-400">
                    {y.eps} ep{y.eps === 1 ? "" : "s"}{y.movies > 0 ? ` · ${y.movies} movie${y.movies === 1 ? "" : "s"}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {stats.ratingCounts.some((n) => n > 0) && (
        <div class="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 class="mb-4 font-semibold">Your ratings</h2>
          <ul class="space-y-1.5">
            {[5, 4, 3, 2, 1].map((r) => {
              const n = stats.ratingCounts[r - 1];
              const maxN = Math.max(1, ...stats.ratingCounts);
              return (
                <li class="flex items-center gap-2 text-xs">
                  <span class="w-16 shrink-0 text-slate-400">{"★".repeat(r)}</span>
                  <div class="bar-grow h-3 rounded bg-gradient-to-r from-violet-600 to-fuchsia-500" style={`width:${Math.max(2, Math.round((n / maxN) * 100))}%`} />
                  <span class="text-slate-400">{n}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {stats.topEpisodes.length > 0 && (
        <div class="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 class="mb-4 font-semibold">Top episodes</h2>
          <ul class="space-y-1.5">
            {stats.topEpisodes.map((e) => (
              <li class="flex items-center gap-2 text-sm">
                <span class="w-16 shrink-0 text-amber-300">{"★".repeat(e.rating)}</span>
                <a href={`/shows/${e.tmdb_id}-${slugify(e.title)}?season=${e.season}`} class="min-w-0 truncate hover:text-violet-400">
                  {e.title} · S{String(e.season).padStart(2, "0")}E{String(e.episode).padStart(2, "0")}
                </a>
              </li>
            ))}
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
                <div class="bar-grow h-3 rounded bg-gradient-to-r from-violet-600 to-fuchsia-500" style={`width:${Math.max(2, Math.round((g.count / Math.max(1, stats.topGenres[0].count)) * 100))}%`} />
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
      share or sell data to anyone. The only cookie we set is the session cookie that keeps you logged in. Page-view
      and search analytics are automatically deleted after 90 days.
    </p>
    <h2 class="text-lg font-semibold text-white">Emails</h2>
    <p>
      We only email you when you ask us to: airing reminders you switch on (opt-out anytime on the calendar page),
      password resets you request, and a welcome note on signup. We never send marketing emails without consent.
    </p>
    <h2 class="text-lg font-semibold text-white">Your rights</h2>
    <p>
      You can delete your account and all associated data at any time from{" "}
      <a href="/settings" class="text-violet-400 underline underline-offset-2">Settings</a> — deletion is immediate and permanent.
      For questions or data requests, contact{" "}
      <a href="mailto:watchdeck@zalize.com" class="text-violet-400 underline underline-offset-2">watchdeck@zalize.com</a>.
    </p>
    <h2 class="text-lg font-semibold text-white">Third parties</h2>
    <p>
      Show and movie metadata comes from <a href="https://www.themoviedb.org/" rel="noopener" class="text-violet-400 underline underline-offset-2">TMDB</a>.
      Poster images are loaded from TMDB's image CDN. Transactional email is delivered by Resend. Hosting is provided by Cloudflare.
    </p>
  </div>
);

export const AboutPage: FC = () => (
  <div class="mx-auto max-w-2xl space-y-4 text-slate-300">
    <h1 class="text-2xl font-bold text-white">About WatchDeck</h1>
    <p>
      WatchDeck is a web-first tracker for TV shows and movies. It exists because millions of people who kept years of
      watch history in TV Time were left without a good home for it — WatchDeck lets you drop in your TV Time GDPR
      export (or a Trakt, Serializd or Netflix CSV) and pick up your next episode about a minute later, from any
      browser, with nothing to install.
    </p>
    <p>
      Beyond tracking, WatchDeck gives you an airing calendar with iCal feeds and email reminders, watch statistics,
      shareable lists and profiles, streaming-availability filters and a year-end Wrapped. Everything works the same on
      phone and desktop. WatchDeck is currently in beta, and every feature is free while the beta lasts.
    </p>
    <p>
      WatchDeck is built by the team behind <a href="https://zalize.com" rel="noopener" class="text-violet-400 underline underline-offset-2">zalize.com</a>.
      Metadata comes from <a href="https://www.themoviedb.org/" rel="noopener" class="text-violet-400 underline underline-offset-2">TMDB</a>
      {" "}(this product uses the TMDB API but is not endorsed or certified by TMDB).
    </p>
    <h2 class="text-lg font-semibold text-white">Press & media kit</h2>
    <p>
      <strong class="text-white">Boilerplate:</strong> “WatchDeck is a web-first TV show and movie tracker. Import your
      TV Time, Trakt, Serializd or Netflix history in one click and continue your next episode from any browser — with
      an airing calendar, watch statistics, shareable lists and a year-end Wrapped. Free while in beta at
      watchdeck.zalize.com.”
    </p>
    <ul class="list-inside list-disc space-y-1 text-sm">
      <li>
        Logo (SVG): <a href="/favicon.svg" download class="text-violet-400 underline underline-offset-2">favicon.svg</a> — violet clapperboard with play
        triangle; keep clear space around it and don't recolor it.
      </li>
      <li>
        Social/OG card (PNG 1200×630): <a href="/og-default.png" download class="text-violet-400 underline underline-offset-2">og-default.png</a>
      </li>
      <li>App icon (PNG 512×512): <a href="/icon-512.png" download class="text-violet-400 underline underline-offset-2">icon-512.png</a></li>
      <li>Name: always “WatchDeck” — one word, capital W and D. Not “Watchdeck”, “Watch Deck” or “WD”.</li>
      <li>Brand colors: violet #7c3aed on near-black #020617.</li>
    </ul>
    <p>
      Press, partnership or data questions:{" "}
      <a href="mailto:watchdeck@zalize.com" class="text-violet-400 underline underline-offset-2">watchdeck@zalize.com</a>.
    </p>
  </div>
);

export const TermsPage: FC = () => (
  <div class="mx-auto max-w-2xl space-y-4 text-slate-300">
    <h1 class="text-2xl font-bold text-white">Terms of service</h1>
    <p class="text-sm text-slate-400">Last updated: August 5, 2026</p>
    <p>
      WatchDeck is a service for tracking TV shows and movies, currently offered as a free beta trial. By using it you agree to these terms.
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

export const SettingsPage: FC<{ user: User; saved?: string; error?: string; services?: Set<number> }> = ({ user, saved, error, services }) => (
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
      <h2 class="font-semibold">My streaming services</h2>
      <p class="mt-1 text-sm text-slate-400">
        Pick the services you subscribe to. Shows and movies streamable on them get a ✓ badge, and your library gains an “On my services” filter.
      </p>
      <form action="/api/settings/services" method="post" class="mt-4">
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {STREAMING_SERVICES.map(([id, name]) => (
            <label class="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-violet-500">
              <input type="checkbox" name="service" value={String(id)} checked={services?.has(id)} class="accent-violet-600" />
              {name}
            </label>
          ))}
        </div>
        <button class="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">Save services</button>
      </form>
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
        Download everything you've tracked — library, statuses, ratings and full watch history. JSON for backups, CSV for spreadsheets and other trackers. Your data is always yours to take.
      </p>
      <div class="mt-4 flex flex-wrap gap-2">
        <a href="/api/export" class="inline-block rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:border-violet-500 hover:text-violet-300" download>
          Download export (JSON)
        </a>
        <a href="/api/export.csv" class="inline-block rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:border-violet-500 hover:text-violet-300" download>
          Download export (CSV)
        </a>
      </div>
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
  plays?: number;
}

export const HistoryPage: FC<{ items: HistoryItem[]; page?: number; lastPage?: number }> = ({ items, page = 1, lastPage = 1 }) => (
  <div>
    <h1 class="mb-6 text-2xl font-bold">History</h1>
    {items.length === 0 ? (
      <EmptyState title="No watch history yet" cta={{ href: "/home", label: "▶ Go to Next Up" }}>
        Mark an episode watched and it shows up here.
      </EmptyState>
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
                          {(it.plays ?? 1) > 1 ? ` · watched ${it.plays}\u00d7` : ""}
                        </p>
                      </div>
                      <form action="/api/history/date" method="post" class="hidden shrink-0 items-center gap-1.5 sm:flex">
                        <input type="hidden" name="kind" value={it.mediaType} />
                        <input type="hidden" name="tmdb_id" value={String(it.tmdbId)} />
                        {it.mediaType === "tv" && it.season != null && it.episode != null && (
                          <>
                            <input type="hidden" name="season" value={String(it.season)} />
                            <input type="hidden" name="episode" value={String(it.episode)} />
                          </>
                        )}
                        <input type="hidden" name="orig" value={it.watchedAt} />
                        <input type="hidden" name="redirect" value={`/history${page > 1 ? `?page=${page}` : ""}`} />
                        <input
                          type="date"
                          name="date"
                          value={it.watchedAt.slice(0, 10)}
                          max={new Date().toISOString().slice(0, 10)}
                          required
                          aria-label={`Watched date for ${it.title}`}
                          class="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 focus:border-violet-500 focus:outline-none"
                        />
                        <button class="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:border-violet-500 hover:text-violet-300">Save</button>
                      </form>
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
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">Your watch stats</h1>
      <a href="/wrapped" class="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">🎬 Your {new Date().getUTCFullYear()} Wrapped</a>
    </div>
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

export const PublicProfilePage: FC<{ stats: UserStats; name: string; lists?: { name: string; share_token: string; item_count: number }[] }> = ({ stats, name, lists }) => (
  <div>
    <h1 class="mb-1 text-2xl font-bold">{name}'s watch stats</h1>
    <p class="mb-6 text-sm text-slate-400">
      Shared from <a href="/" class="text-violet-400 hover:underline">WatchDeck</a> — track your shows &amp; movies on the web.
    </p>
    <StatsBody stats={stats} />
    {lists && lists.length > 0 && (
      <section class="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 class="font-semibold">{name}'s public lists</h2>
        <ul class="mt-3 space-y-2">
          {lists.map((l) => (
            <li>
              <a href={`/list/${l.share_token}`} class="text-violet-400 hover:underline">{l.name}</a>
              <span class="ml-2 text-xs text-slate-400">{l.item_count} item{l.item_count === 1 ? "" : "s"}</span>
            </li>
          ))}
        </ul>
      </section>
    )}
    <div class="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center">
      <p class="text-slate-300">Want stats like these?</p>
      <a href="/signup" class="mt-3 inline-block rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">Start tracking — free in beta</a>
    </div>
  </div>
);

export interface WrappedStats {
  year: number;
  eps: number;
  movies: number;
  hours: number;
  days: number;
  bestStreak: number;
  topShows: { title: string; tmdb_id: number; eps: number; poster_path: string | null }[];
  topGenres: { name: string; count: number }[];
  byMonth: { month: number; count: number }[];
  busiestMonth: { month: string; count: number } | null;
  ratingsGiven: number;
  avgEpisodeRating: number | null;
  topRated: { title: string; rating: number } | null;
  firstWatch: { title: string; date: string } | null;
}

const MONTH_ABBR = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export const WrappedPage: FC<{ stats: WrappedStats; name: string; shareUrl?: string | null; years?: number[]; public?: boolean }> = ({ stats, name, shareUrl, years, public: isPublic }) => {
  const monthCounts = Array.from({ length: 12 }, (_, i) => stats.byMonth.find((m) => m.month === i + 1)?.count ?? 0);
  const maxMonth = Math.max(1, ...monthCounts);
  const hasData = stats.eps > 0 || stats.movies > 0;
  return (
    <div class="mx-auto max-w-2xl">
      <div class="relative overflow-hidden rounded-3xl border border-violet-900/60 bg-gradient-to-b from-violet-950/60 via-slate-950 to-slate-950 px-6 py-10 text-center">
        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-violet-400">WatchDeck Wrapped</p>
        <h1 class="mt-3 bg-gradient-to-r from-violet-300 via-fuchsia-300 to-violet-300 bg-clip-text text-6xl font-extrabold tracking-tight text-transparent sm:text-7xl">{stats.year}</h1>
        <p class="mt-3 text-slate-300">{isPublic ? `${name}'s year in TV & film` : "Your year in TV & film"}</p>
      </div>
      {!isPublic && years && years.length > 1 && (
        <nav class="mt-4 flex flex-wrap justify-center gap-2" aria-label="Wrapped years">
          {years.map((y) => (
            <a href={`/wrapped/${y}`} class={`rounded-full px-3 py-1 text-sm ${y === stats.year ? "bg-violet-600 font-semibold text-white" : "border border-slate-700 text-slate-300 hover:border-violet-500"}`} aria-current={y === stats.year ? "page" : undefined}>
              {y}
            </a>
          ))}
        </nav>
      )}
      {!hasData ? (
        <div class="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center">
          <p class="text-slate-300">No watches logged in {stats.year}{isPublic ? "" : " yet"}.</p>
          {!isPublic && (
            <p class="mt-2 text-sm text-slate-400">
              <a href="/import" class="text-violet-400 hover:underline">Import your history</a> or mark episodes watched to build your Wrapped.
            </p>
          )}
        </div>
      ) : (
        <div class="mt-8 space-y-6">
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              [stats.hours.toLocaleString("en-US"), "hours watched", "Estimated from real episode and movie runtimes."],
              [String(stats.eps), "episodes", `Episodes you watched in ${stats.year}.`],
              [String(stats.movies), "movies", `Movies you watched in ${stats.year}.`],
              [String(stats.days), `day${stats.days === 1 ? "" : "s"} watching`, `Days in ${stats.year} where you watched at least one thing.`],
            ].map(([n, label, tip]) => (
              <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-center">
                <p class="stat-num text-3xl font-extrabold text-violet-300">{n}</p>
                <p class="mt-1 text-sm text-slate-400">
                  {label}
                  <Hint tip={tip} />
                </p>
              </div>
            ))}
          </div>
          {stats.topShows.length > 0 && (
            <section class="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
              <h2 class="font-semibold">Top shows of {stats.year}</h2>
              <ol class="mt-4 flex flex-wrap justify-center gap-4">
                {stats.topShows.map((s, i) => (
                  <li class="w-24 text-center sm:w-28">
                    <a href={`/shows/${s.tmdb_id}-${slugify(s.title)}`} class="group block">
                      <div class="relative">
                        <img src={poster(s.poster_path, "w185")} alt={s.title} width="185" height="278" loading="lazy" class="w-full rounded-xl border border-slate-800 group-hover:border-violet-500" />
                        <span class="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">{i + 1}</span>
                      </div>
                      <p class="mt-2 truncate text-xs text-slate-300 group-hover:text-violet-300">{s.title}</p>
                      <p class="text-xs text-slate-400">{s.eps} eps</p>
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <div class="grid gap-6 sm:grid-cols-2">
            <section class="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
              <h2 class="font-semibold">Watching rhythm</h2>
              <p class="mt-1 text-xs text-slate-400">How your watching spread across the year, month by month.</p>
              <div class="mt-4 flex h-24 items-end gap-1" role="img" aria-label={`Watches per month in ${stats.year}`}>
                {monthCounts.map((n, i) => (
                  <div class="flex flex-1 flex-col items-center gap-1">
                    <div class="w-full rounded-t bg-gradient-to-t from-violet-700 to-fuchsia-500" style={`height:${n === 0 ? 2 : Math.max(6, Math.round((n / maxMonth) * 80))}px`} title={`${n} watches`} />
                    <span class="text-[10px] text-slate-500">{MONTH_ABBR[i]}</span>
                  </div>
                ))}
              </div>
              {stats.busiestMonth && (
                <p class="mt-3 text-sm text-slate-400">
                  Busiest month: <span class="font-semibold text-violet-300">{stats.busiestMonth.month}</span> ({stats.busiestMonth.count} watch{stats.busiestMonth.count === 1 ? "" : "es"})
                </p>
              )}
              {stats.bestStreak >= 2 && (
                <p class="mt-1 text-sm text-slate-400">
                  🔥 Longest streak: <span class="font-semibold text-violet-300">{stats.bestStreak} days</span> in a row
                </p>
              )}
            </section>
            <section class="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
              <h2 class="font-semibold">Taste profile</h2>
              <p class="mt-1 text-xs text-slate-400">The genres you watched most this year — your comfort zone at a glance.</p>
              {stats.topGenres.length === 0 ? (
                <p class="mt-3 text-sm text-slate-400">Not enough data for genres.</p>
              ) : (
                <ul class="mt-3 flex flex-wrap gap-2">
                  {stats.topGenres.map((g, i) => (
                    <li class={`rounded-full px-3 py-1 text-sm ${i === 0 ? "bg-violet-600 font-semibold text-white" : "border border-slate-700 text-slate-300"}`}>{g.name}</li>
                  ))}
                </ul>
              )}
              {stats.topRated && (
                <p class="mt-4 text-sm text-slate-400">
                  Highest rated: <span class="font-semibold text-violet-300">{stats.topRated.title}</span> {"★".repeat(stats.topRated.rating)}
                </p>
              )}
              {stats.ratingsGiven > 0 && (
                <p class="mt-1 text-sm text-slate-400">
                  {stats.ratingsGiven} episode rating{stats.ratingsGiven === 1 ? "" : "s"} given{stats.avgEpisodeRating != null ? <> · avg ★{stats.avgEpisodeRating}</> : null}
                </p>
              )}
              {stats.firstWatch && (
                <p class="mt-1 text-sm text-slate-400">
                  First watch of {stats.year}: <span class="font-semibold text-violet-300">{stats.firstWatch.title}</span> on {stats.firstWatch.date}
                </p>
              )}
            </section>
          </div>
        </div>
      )}
      {isPublic ? (
        <div class="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center">
          <p class="text-slate-300">Want a Wrapped like this?</p>
          <a href="/signup" class="mt-3 inline-block rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">Start tracking — free in beta</a>
        </div>
      ) : (
        <div class="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 class="font-semibold">Share your {stats.year} Wrapped</h2>
          {shareUrl ? (
            <div class="mt-3">
              <p class="text-sm text-slate-400">Anyone with this link sees a read-only copy with a shareable poster card (no email shown):</p>
              <p class="mt-2 break-all rounded-lg bg-slate-800/70 px-3 py-2 font-mono text-sm text-violet-300">{shareUrl}</p>
              <form action="/api/wrapped/share" method="post" class="mt-3">
                <input type="hidden" name="year" value={String(stats.year)} />
                <input type="hidden" name="enabled" value="" />
                <button class="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-red-500 hover:text-red-400">Disable share link</button>
              </form>
            </div>
          ) : (
            <div class="mt-3">
              <p class="text-sm text-slate-400">Create a public link with a poster-style share card — perfect for a year-in-review post.</p>
              <form action="/api/wrapped/share" method="post" class="mt-3">
                <input type="hidden" name="year" value={String(stats.year)} />
                <input type="hidden" name="enabled" value="1" />
                <button class="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Create share link</button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const PricingPage: FC<{ loggedIn?: boolean }> = ({ loggedIn }) => (
  <div class="mx-auto max-w-4xl">
    <div class="py-10 text-center">
      <p class="mb-3 inline-block rounded-full border border-violet-700 bg-violet-950/60 px-3 py-1 text-xs font-semibold text-violet-300">
        BETA — everything below is free right now
      </p>
      <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">Simple pricing, honest beta</h1>
      <p class="mx-auto mt-3 max-w-xl text-slate-400">
        These are the plans WatchDeck will offer after the beta. While we're in beta, <strong class="text-slate-200">every member gets the full Plus plan for free</strong> — no card, no charges, no catch.
      </p>
    </div>
    <div class="grid gap-6 sm:grid-cols-2">
      <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 class="text-lg font-bold">Free</h2>
        <p class="mt-1 text-sm text-slate-400">Everything you need to keep watching.</p>
        <p class="mt-4 text-3xl font-extrabold">$0<span class="text-base font-normal text-slate-400"> / forever</span></p>
        <ul class="mt-5 space-y-2 text-sm text-slate-300">
          <li>✓ Track TV shows &amp; movies, episode by episode</li>
          <li>✓ Next Up with episodes-left badges</li>
          <li>✓ TV Time ZIP, Trakt/Serializd CSV &amp; Netflix import</li>
          <li>✓ Airing calendar</li>
          <li>✓ Ratings &amp; private notes</li>
          <li>✓ Full data export (JSON &amp; CSV) — always free</li>
        </ul>
      </div>
      <div class="relative rounded-2xl border border-violet-600 bg-violet-950/30 p-6">
        <span class="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-0.5 text-xs font-semibold text-white">Free during beta</span>
        <h2 class="text-lg font-bold">Plus</h2>
        <p class="mt-1 text-sm text-slate-400">For serious trackers — keeps WatchDeck independent.</p>
        <p class="mt-4 text-3xl font-extrabold">$1.99<span class="text-base font-normal text-slate-400"> / month</span></p>
        <p class="text-sm text-slate-400">or $19 / year (save 20%)</p>
        <ul class="mt-5 space-y-2 text-sm text-slate-300">
          <li>✓ Everything in Free</li>
          <li>✓ iCal calendar feeds for Google/Apple Calendar</li>
          <li>✓ Email airing reminders</li>
          <li>✓ Advanced statistics — hours, genres, by-year, ratings</li>
          <li>✓ Public share page with stats card</li>
          <li>✓ Priority support &amp; early access to new features</li>
        </ul>
      </div>
    </div>
    <div class="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center">
      <p class="text-slate-300">Payments aren't live yet — joining the beta gives you the full Plus plan at no cost.</p>
      {!loggedIn && (
        <a href="/signup" class="mt-4 inline-block rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-500">
          Join the beta — free
        </a>
      )}
    </div>
    <p class="mt-6 text-center text-xs text-slate-400">
      Beta members will be told well in advance before any plan change, and exporting your data stays free forever.
    </p>
  </div>
);

export const ImportPage: FC<{ welcome?: boolean }> = ({ welcome }) => (
  <div class="mx-auto max-w-2xl">
    {welcome && (
      <section class="mb-8 rounded-2xl border border-violet-900/60 bg-violet-950/30 p-5" aria-label="Welcome">
        <h2 class="text-lg font-semibold">Welcome to WatchDeck 🎬</h2>
        <p class="mt-1 text-sm text-slate-300">You're in — three quick steps and you're tracking:</p>
        <ol class="mt-2 list-inside list-decimal space-y-1 text-sm text-slate-300">
          <li>Drop in your TV Time export below — or <a href="/search" class="text-violet-400 hover:underline">search a show</a> and hit Track.</li>
          <li>Mark the episodes you've already seen.</li>
          <li><a href="/home" class="text-violet-400 hover:underline">Next Up</a> tells you exactly what to watch next.</li>
        </ol>
      </section>
    )}
    <h1 class="text-2xl font-bold">Import from TV Time</h1>
    <p class="mt-2 text-slate-400">
      Upload the ZIP you got from{" "}
      <a href="https://gdpr.tvtime.com/gdpr/self-service" rel="noopener" class="text-violet-400 hover:underline">
        gdpr.tvtime.com
      </a>
      . We import your tracked episodes, followed shows <strong>and movies</strong> — then take you straight to your next episode. Coming
      from Trakt or Serializd? A CSV export with a title column works too — a rating column (1–5 or 1–10) becomes your star ratings. Netflix's ViewingActivity.csv also works — shows are added to
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
        <p class="mt-1 text-xs text-slate-400">This usually happens when a title was renamed or spelled differently. Search for each one and everything else stays intact — nothing was lost.</p>
        <ul id="unmatched-list" class="mt-2 space-y-1 text-sm"></ul>
      </div>
      <a href="/home" class="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500">
        Show me my next episode →
      </a>
    </div>
    <script src="/import.js" />
  </div>
);

export interface ListRow {
  id: number;
  name: string;
  created_at: string;
  item_count: number;
  posters: string;
}

export const ListsPage: FC<{ lists: ListRow[]; error?: string }> = ({ lists, error }) => (
  <div class="mx-auto max-w-3xl">
    <h1 class="mb-2 text-2xl font-bold">Your lists</h1>
    <p class="mb-6 text-sm text-slate-400">Group anything however you like — "Cozy autumn rewatches", "Watch with Sam", "Best of 2025". Add items from any show or movie page.</p>
    {error && <p class="mb-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-300">{error}</p>}
    <form action="/api/lists" method="post" class="mb-8 flex gap-2">
      <input
        type="text"
        name="name"
        required
        maxlength={60}
        placeholder="New list name…"
        aria-label="New list name"
        class="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm placeholder-slate-500 focus:border-violet-500 focus:outline-none"
      />
      <button class="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">Create list</button>
    </form>
    {lists.length === 0 ? (
      <p class="text-slate-400">No lists yet — create your first one above.</p>
    ) : (
      <ul class="space-y-3">
        {lists.map((l) => (
          <li class="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div class="flex shrink-0 -space-x-3">
              {(l.posters ? l.posters.split(",").filter(Boolean) : []).slice(0, 4).map((p) => (
                <img src={poster(p)} alt="" width={36} height={54} loading="lazy" class="h-[54px] w-9 rounded border border-slate-700 object-cover" />
              ))}
              {!l.posters && <span class="flex h-[54px] w-9 items-center justify-center rounded border border-dashed border-slate-700 text-slate-600">·</span>}
            </div>
            <div class="min-w-0 flex-1">
              <a href={`/lists/${l.id}`} class="font-medium hover:text-violet-400">{l.name}</a>
              <p class="text-xs text-slate-400">{l.item_count} item{l.item_count === 1 ? "" : "s"}</p>
            </div>
            <form action="/api/lists/delete" method="post" data-confirm={`Delete list "${l.name}"?`}>
              <input type="hidden" name="list_id" value={String(l.id)} />
              <button class="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-red-400">Delete</button>
            </form>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export const ListDetailPage: FC<{ list: { id: number; name: string }; items: { tmdb_id: number; media_type: string; title: string; poster_path: string | null }[]; shareUrl?: string | null }> = ({ list, items, shareUrl }) => (
  <div>
    <p class="mb-1 text-sm"><a href="/lists" class="text-violet-400 hover:underline">← Your lists</a></p>
    <h1 class="mb-1 text-2xl font-bold">{list.name}</h1>
    <p class="mb-4 text-sm text-slate-400">{items.length} item{items.length === 1 ? "" : "s"}</p>
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <form action="/api/lists/share" method="post">
        <input type="hidden" name="list_id" value={String(list.id)} />
        <input type="hidden" name="enabled" value={shareUrl ? "0" : "1"} />
        <button class="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-violet-500">
          {shareUrl ? "🔒 Make private" : "🔗 Share publicly"}
        </button>
      </form>
      {shareUrl && (
        <a href={shareUrl} class="break-all text-sm text-violet-400 hover:underline">{shareUrl}</a>
      )}
    </div>
    {items.length === 0 ? (
      <EmptyState title="This list is empty">
        Open any show or movie page and use the <span class="text-slate-300">☰ Lists</span> button to add it.
      </EmptyState>
    ) : (
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 stagger-in">
        {items.map((it) => (
          <div>
            <a href={`/${it.media_type === "tv" ? "shows" : "movies"}/${it.tmdb_id}-${slugify(it.title)}`} class="group block">
              <img
                src={poster(it.poster_path)}
                alt={it.title}
                loading="lazy"
                class="aspect-[2/3] w-full rounded-xl border object-cover poster-fx"
              />
              <p class="mt-2 line-clamp-1 text-sm font-medium group-hover:text-violet-400">{it.title}</p>
            </a>
            <form action="/api/lists/remove" method="post" class="mt-1">
              <input type="hidden" name="list_id" value={String(list.id)} />
              <input type="hidden" name="tmdb_id" value={String(it.tmdb_id)} />
              <input type="hidden" name="media_type" value={it.media_type} />
              <input type="hidden" name="redirect" value={`/lists/${list.id}`} />
              <button class="text-xs text-slate-500 hover:text-red-400">Remove</button>
            </form>
          </div>
        ))}
      </div>
    )}
  </div>
);

export const PublicListPage: FC<{ name: string; owner: string; items: { tmdb_id: number; media_type: string; title: string; poster_path: string | null }[] }> = ({ name, owner, items }) => (
  <div>
    <h1 class="mb-1 text-2xl font-bold">{name}</h1>
    <p class="mb-6 text-sm text-slate-400">
      A list by {owner}, shared from <a href="/" class="text-violet-400 hover:underline">WatchDeck</a> · {items.length} item{items.length === 1 ? "" : "s"}
    </p>
    {items.length === 0 ? (
      <EmptyState title="This list is empty right now">Check back later — the owner may still be adding titles.</EmptyState>
    ) : (
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 stagger-in">
        {items.map((it) => (
          <a href={`/${it.media_type === "tv" ? "shows" : "movies"}/${it.tmdb_id}-${slugify(it.title)}`} class="group block">
            <img
              src={poster(it.poster_path)}
              alt={it.title}
              loading="lazy"
              class="aspect-[2/3] w-full rounded-xl border object-cover poster-fx"
            />
            <p class="mt-2 line-clamp-1 text-sm font-medium group-hover:text-violet-400">{it.title}</p>
          </a>
        ))}
      </div>
    )}
    <div class="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center">
      <p class="text-slate-300">Make lists like this for your own shows &amp; movies.</p>
      <a href="/signup" class="mt-3 inline-block rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">Start tracking — free in beta</a>
    </div>
  </div>
);

export const MorePage: FC = () => (
  <div class="mx-auto max-w-2xl">
    <h1 class="mb-6 text-2xl font-bold">More</h1>
    <div class="grid grid-cols-2 gap-3">
      {[
        ["/lists", "☰ Lists", "Your custom lists"],
        ["/browse", "🧭 Discover", "Trending & browse by genre"],
        ["/import", "📥 Import", "TV Time, Trakt, Netflix & more"],
        ["/history", "🕘 History", "Everything you've watched"],
        ["/stats", "📊 Stats", "Hours, streaks & top shows"],
        [`/wrapped/${new Date().getFullYear()}`, "✨ Wrapped", "Your year in review"],
        ["/roulette", "🎲 Roulette", "Can't decide? Spin one"],
        ["/settings", "⚙ Settings", "Account & preferences"],
      ].map(([href, label, sub]) => (
        <a href={href} class="card block p-4">
          <p class="font-medium">{label}</p>
          <p class="mt-0.5 text-xs text-slate-400">{sub}</p>
        </a>
      ))}
    </div>
    <form action="/logout" method="post" class="mt-6">
      <button class="w-full rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:border-red-900 hover:text-red-400">Log out</button>
    </form>
  </div>
);
