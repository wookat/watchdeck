import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import type { AppContext, Env } from "./types";
import { hashPassword, verifyPassword, needsRehash, createSession, destroySession, loadUser } from "./auth";
import {
  searchMulti,
  searchPerson,
  searchTv,
  searchMovie,
  tvDetails,
  seasonDetails,
  movieDetails,
  movieDirectors,
  trendingTv,
  trendingMovies,
  upcomingMovies,
  onTheAirTv,
  genreList,
  discoverByGenre,
  discoverByNetwork,
  discoverByYear,
  discoverPopular,
  topRated,
  NETWORKS,
  recommendations,
  watchProviders,
  STREAMING_SERVICES,
  trailerUrl,
  slugify,
  metaDescription,
  type SearchResult,
  topCast,
  personDetails,
  personCredits,
  popularPeople,
  type CastMember,
  collectionDetails,
} from "./tmdb";
import { parseTvTimeZip, parseGenericCsv, isNetflixCsv, parseNetflixCsv, type ParsedImport } from "./importer";
import { sendEmail, welcomeEmail, resetEmail, confirmSignupEmail } from "./email";
import { shareOgImage, listOgImage, wrappedOgImage, guideOgImage } from "./og";
import {
  CSS_VERSION,
  Layout,
  Landing,
  landingFaqs,
  AuthForm,
  ForgotForm,
  ResetForm,
  HomePage,
  SearchPage,
  TrendingSection,
  ShowPage,
  MoviePage,
  PersonPage,
  LibraryPage,
  CalendarPage,
  ImportPage,
  MorePage,
  StatsPage,
  PublicProfilePage,
  BrowseIndex,
  BrowseGenre,
  BrowseNetwork,
  BrowseYear,
  BrowseTopRated,
  BrowseTrending,
  BrowseChartList,
  type UserStats,
  type NextUpItem,
  type HistoryItem,
  HistoryPage,
  SettingsPage,
  PrivacyPage,
  TermsPage,
  AboutPage,
  GUIDES,
  GuidesIndexPage,
  GuidePage,
  PricingPage,
  type WatchlistPreviewItem,
  type LibraryRow,
  type CalendarItem,
  type ListRef,
  type ListRow,
  ListsPage,
  ListDetailPage,
  PublicListPage,
  WrappedPage,
  type WrappedStats,
} from "./views";

const SERVICE_IDS = new Set(STREAMING_SERVICES.map(([id]) => id));

async function userServices(env: Env, userId: number): Promise<Set<number>> {
  const rows = await env.DB.prepare("SELECT provider_id FROM user_services WHERE user_id = ?").bind(userId).all<{ provider_id: number }>();
  return new Set(rows.results.map((r) => r.provider_id));
}

function userLists(env: Env, userId: number, tmdbId: number, mediaType: "tv" | "movie") {
  return env.DB.prepare(
    `SELECT l.id, l.name, EXISTS(SELECT 1 FROM list_items li WHERE li.list_id = l.id AND li.tmdb_id = ? AND li.media_type = ?) AS has
     FROM lists l WHERE l.user_id = ? ORDER BY l.name COLLATE NOCASE`
  )
    .bind(tmdbId, mediaType, userId)
    .all<ListRef>();
}

const app = new Hono<AppContext>();

app.use("*", (c, next) => {
  c.env.waitUntil = (p) => c.executionCtx.waitUntil(p);
  return next();
});

app.use("*", (c, next) => {
  // RFC 8058 one-click unsubscribe: mailbox providers POST without an Origin header
  if (c.req.method === "POST" && /^\/unsubscribe\/[^/]+$/.test(new URL(c.req.url).pathname)) return next();
  return csrf({ origin: (origin) => origin === new URL(c.env.SITE_URL).origin || origin === new URL(c.req.url).origin })(c, next);
});

app.use("*", async (c, next) => {
  await next();
  const h = c.res.headers;
  h.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  h.set("x-content-type-options", "nosniff");
  h.set("x-frame-options", "DENY");
  h.set("referrer-policy", "strict-origin-when-cross-origin");
  h.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  const url = new URL(c.req.url);
  const path = url.pathname;
  if (
    /^\/(home|library|lists|roulette|calendar|import|stats|history|settings|more|forgot|reset|unsubscribe|confirm-email|u|wrapped)(\/|$)/.test(path) ||
    (path === "/search" && url.searchParams.has("q"))
  ) {
    h.set("x-robots-tag", "noindex");
  }
  if (/^\/(home|library|lists|roulette|calendar|import|stats|history|settings|more|wrapped)(\/|$)/.test(path) && c.res.headers.get("content-type")?.includes("text/html")) {
    h.set("cache-control", "private, no-store");
  }
  if (c.res.headers.get("content-type")?.includes("text/html")) {
    h.set("speculation-rules", '"/speculationrules.json"');
    h.set(
      "link",
      `</styles.css?v=${CSS_VERSION}>; rel=preload; as=style, </fonts/sora-latin.woff2>; rel=preload; as=font; type="font/woff2"; crossorigin`
    );
    h.set(
      "content-security-policy",
      "default-src 'self'; img-src 'self' https://image.tmdb.org data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
    );
  }
});

app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  if ((c.req.method === "GET" || c.req.method === "HEAD") && url.pathname.length > 1 && url.pathname.endsWith("/") && !url.pathname.startsWith("//")) {
    return c.redirect(url.pathname.replace(/\/+$/, "") + url.search, 301);
  }
  return next();
});

const RATE_WINDOW_MS = 600_000;

function rateLimitKey(c: { req: { header: (n: string) => string | undefined } }, bucket: string): string {
  return `rl:${bucket}:${c.req.header("cf-connecting-ip") ?? "unknown"}`;
}

async function rateLimit(c: { env: { CACHE: KVNamespace }; req: { header: (n: string) => string | undefined } }, bucket: string, limit: number): Promise<boolean> {
  const key = rateLimitKey(c, bucket);
  const now = Date.now();
  const raw = await c.env.CACHE.get(key);
  let n = 0;
  let exp = now + RATE_WINDOW_MS;
  if (raw) {
    const parts = raw.split(":");
    const storedExp = parseInt(parts[1] ?? "0", 10);
    if (storedExp > now) {
      n = parseInt(parts[0] ?? "0", 10);
      exp = storedExp;
    }
  }
  n += 1;
  await c.env.CACHE.put(key, `${n}:${exp}`, { expirationTtl: Math.max(60, Math.ceil((exp - now) / 1000)) });
  return n <= limit;
}

app.use("*", async (c, next) => {
  c.set("user", await loadUser(c));
  await next();
  // first-party, cookieless page-view analytics (HTML GETs only)
  if (
    c.req.method === "GET" &&
    c.res.headers.get("content-type")?.includes("text/html") &&
    !c.req.path.startsWith("/api")
  ) {
    const ua = c.req.header("user-agent") ?? "";
    const uaClass = /bot|crawl|spider/i.test(ua) ? "bot" : /mobile/i.test(ua) ? "mobile" : "desktop";
    const country = (c.req.raw as { cf?: { country?: string } }).cf?.country ?? null;
    const referrer = c.req.header("referer") ?? null;
    c.executionCtx.waitUntil(
      c.env.DB.prepare("INSERT INTO analytics_events (path, referrer, country, ua_class) VALUES (?, ?, ?, ?)")
        .bind(c.req.path, referrer, country, uaClass)
        .run()
        .catch(() => {})
    );
  }
});

app.get("/", async (c) => {
  const user = c.get("user");
  if (user) return c.redirect("/home");
  let trending: { shows: SearchResult[]; movies: SearchResult[] } | null = null;
  try {
    const [shows, movies] = await Promise.all([trendingTv(c.env), trendingMovies(c.env)]);
    trending = { shows: shows.results, movies: movies.results };
  } catch {}
  return c.html(
    <Layout
      user={null}
      canonical={c.env.SITE_URL + "/"}
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebSite",
            name: "WatchDeck",
            url: c.env.SITE_URL + "/",
            potentialAction: {
              "@type": "SearchAction",
              target: { "@type": "EntryPoint", urlTemplate: `${c.env.SITE_URL}/search?q={search_term_string}` },
              "query-input": "required name=search_term_string",
            },
          },
          {
            "@type": "FAQPage",
            mainEntity: landingFaqs.map(([q, a]) => ({
              "@type": "Question",
              name: q,
              acceptedAnswer: { "@type": "Answer", text: a },
            })),
          },
        ],
      }}
    >
      <div>
        <Landing subscribed={c.req.query("subscribed") === "1"} />
        {trending ? <TrendingSection shows={trending.shows} movies={trending.movies} /> : null}
      </div>
    </Layout>
  );
});

// ---------- auth ----------
function loginRedirect(c: { req: { method: string; url: string }; redirect: (u: string) => Response }): Response {
  if (c.req.method !== "GET") return c.redirect("/login");
  const u = new URL(c.req.url);
  return c.redirect(`/login?next=${encodeURIComponent(u.pathname + u.search)}`);
}

function safeNext(raw: unknown): string | undefined {
  const s = typeof raw === "string" ? raw : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.includes("\\") ? s : undefined;
}

app.get("/signup", (c) => c.html(<Layout user={c.get("user")} title="Sign up"><AuthForm mode="signup" next={safeNext(c.req.query("next"))} /></Layout>));
app.get("/login", (c) => c.html(<Layout user={c.get("user")} title="Log in"><AuthForm mode="login" next={safeNext(c.req.query("next"))} /></Layout>));

app.post("/signup", async (c) => {
  const form = await c.req.parseBody();
  if (!(await rateLimit(c, "signup", 10))) {
    return c.html(<Layout user={null} title="Sign up"><AuthForm mode="signup" error="Too many attempts. Please try again in a few minutes." next={safeNext(form.next)} /></Layout>, 429);
  }
  const email = String(form.email ?? "").trim().toLowerCase();
  const password = String(form.password ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 8) {
    return c.html(<Layout user={null} title="Sign up"><AuthForm mode="signup" error="Enter a valid email and a password of 8+ characters." next={safeNext(form.next)} /></Layout>, 400);
  }
  const { hash, salt } = await hashPassword(password);
  const insert = () =>
    c.env.DB.prepare("INSERT INTO users (email, password_hash, salt) VALUES (?, ?, ?) RETURNING id")
      .bind(email, hash, salt)
      .first<{ id: number }>();
  let res;
  try {
    try {
      res = await insert();
    } catch (err) {
      if (String(err).includes("UNIQUE")) throw err;
      res = await insert();
    }
  } catch (err) {
    if (String(err).includes("UNIQUE")) {
      return c.html(<Layout user={null} title="Sign up"><AuthForm mode="signup" error="That email is already registered." next={safeNext(form.next)} /></Layout>, 400);
    }
    console.error(err);
    return c.html(<Layout user={null} title="Sign up"><AuthForm mode="signup" error="Something went wrong on our side — please try again." next={safeNext(form.next)} /></Layout>, 500);
  }
  await createSession(c, res!.id);
  c.executionCtx.waitUntil(sendEmail(c.env, email, ...welcomeEmail(c.env.SITE_URL)));
  return c.redirect(safeNext(form.next) ?? "/import?welcome=1");
});

app.post("/login", async (c) => {
  const form = await c.req.parseBody();
  if (!(await rateLimit(c, "login", 15))) {
    return c.html(<Layout user={null} title="Log in"><AuthForm mode="login" error="Too many attempts. Please try again in a few minutes." next={safeNext(form.next)} /></Layout>, 429);
  }
  const email = String(form.email ?? "").trim().toLowerCase();
  const password = String(form.password ?? "");
  const row = await c.env.DB.prepare("SELECT id, password_hash, salt FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: number; password_hash: string; salt: string }>();
  if (!row || !(await verifyPassword(password, row.salt, row.password_hash))) {
    return c.html(<Layout user={null} title="Log in"><AuthForm mode="login" error="Wrong email or password." next={safeNext(form.next)} /></Layout>, 401);
  }
  await createSession(c, row.id);
  if (needsRehash(row.password_hash)) {
    const { hash, salt } = await hashPassword(password);
    c.executionCtx.waitUntil(
      c.env.DB.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?").bind(hash, salt, row.id).run()
    );
  }
  c.executionCtx.waitUntil(c.env.CACHE.delete(rateLimitKey(c, "login")).catch(() => {}));
  return c.redirect(safeNext(form.next) ?? "/home");
});

app.get("/forgot", (c) => c.html(<Layout user={c.get("user")} title="Reset password"><ForgotForm /></Layout>));

app.post("/forgot", async (c) => {
  if (!(await rateLimit(c, "forgot", 5))) {
    return c.html(<Layout user={null} title="Reset password"><ForgotForm error="Too many attempts. Please try again in a few minutes." /></Layout>, 429);
  }
  const form = await c.req.parseBody();
  const email = String(form.email ?? "").trim().toLowerCase();
  const row = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: number }>();
  if (row) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    await c.env.DB.prepare("INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+1 hour'))")
      .bind(token, row.id)
      .run();
    c.executionCtx.waitUntil(sendEmail(c.env, email, ...resetEmail(c.env.SITE_URL, token)));
  }
  return c.html(<Layout user={c.get("user")} title="Reset password"><ForgotForm sent /></Layout>);
});

async function validResetToken(env: Env, token: string): Promise<number | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const row = await env.DB.prepare("SELECT user_id FROM password_resets WHERE token = ? AND expires_at > datetime('now')")
    .bind(token)
    .first<{ user_id: number }>();
  return row?.user_id ?? null;
}

app.get("/reset/:token", async (c) => {
  const token = c.req.param("token");
  if (!(await validResetToken(c.env, token))) {
    return c.html(<Layout user={null} title="Reset password"><ForgotForm error="That reset link is invalid or expired. Request a new one below." /></Layout>, 404);
  }
  return c.html(<Layout user={c.get("user")} title="Choose a new password"><ResetForm token={token} /></Layout>);
});

app.post("/reset/:token", async (c) => {
  const token = c.req.param("token");
  const userId = await validResetToken(c.env, token);
  if (!userId) {
    return c.html(<Layout user={null} title="Reset password"><ForgotForm error="That reset link is invalid or expired. Request a new one below." /></Layout>, 404);
  }
  const form = await c.req.parseBody();
  const password = String(form.password ?? "");
  if (password.length < 8) {
    return c.html(<Layout user={null} title="Choose a new password"><ResetForm token={token} error="Password must be 8+ characters." /></Layout>, 400);
  }
  const { hash, salt } = await hashPassword(password);
  await c.env.DB.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?").bind(hash, salt, userId).run();
  await c.env.DB.prepare("DELETE FROM password_resets WHERE user_id = ?").bind(userId).run();
  await c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
  await createSession(c, userId);
  return c.redirect("/home");
});

app.post("/logout", async (c) => {
  await destroySession(c);
  return c.redirect("/");
});

// ---------- app pages ----------
app.get("/home", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const tracked = await c.env.DB.prepare(
    "SELECT tmdb_id, title, poster_path FROM tracked WHERE user_id = ? AND media_type = 'tv' AND status = 'watching' ORDER BY updated_at DESC LIMIT 18"
  )
    .bind(user.id)
    .all<{ tmdb_id: number; title: string; poster_path: string | null }>();

  const today = new Date().toISOString().slice(0, 10);
  const perShow = await Promise.all(
    tracked.results.map(async (t): Promise<NextUpItem | null> => {
      try {
        const details = await tvDetails(c.env, t.tmdb_id);
        const watched = await c.env.DB.prepare(
          "SELECT season, episode FROM episode_watches WHERE user_id = ? AND tmdb_id = ?"
        )
          .bind(user.id, t.tmdb_id)
          .all<{ season: number; episode: number }>();
        const seen = new Set(watched.results.map((w) => `${w.season}x${w.episode}`));
        let first: NextUpItem | null = null;
        let left = 0;
        const seasons = await Promise.all(
          details.seasons.filter((s) => s.season_number > 0).map((s) => seasonDetails(c.env, t.tmdb_id, s.season_number))
        );
        for (const season of seasons) {
          for (const ep of season.episodes) {
            if (ep.air_date && ep.air_date <= today && !seen.has(`${ep.season_number}x${ep.episode_number}`)) {
              left++;
              if (!first) {
                first = {
                  tmdbId: t.tmdb_id,
                  title: details.name,
                  posterPath: details.poster_path,
                  season: ep.season_number,
                  episode: ep.episode_number,
                  episodeName: ep.name,
                  airDate: ep.air_date,
                  episodesLeft: 1,
                };
              }
            }
          }
        }
        if (first) {
          first.episodesLeft = left;
          return first;
        }
      } catch {
        // TMDB hiccup on one show shouldn't kill the page
      }
      return null;
    })
  );
  const nextUp = perShow.filter((x): x is NextUpItem => x !== null);
  const wl = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM tracked WHERE user_id = ? AND status = 'watchlist'")
    .bind(user.id)
    .first<{ n: number }>();
  const watchCounts = await c.env.DB.prepare(
    "SELECT (SELECT COUNT(*) FROM episode_watches WHERE user_id = ?1) + (SELECT COUNT(*) FROM movie_watches WHERE user_id = ?1) AS n"
  )
    .bind(user.id)
    .first<{ n: number }>();
  const hasWatch = (watchCounts?.n ?? 0) > 0;
  const watchlistPreview =
    nextUp.length === 0 && (wl?.n ?? 0) > 0
      ? (
          await c.env.DB.prepare(
            "SELECT tmdb_id, media_type, title, poster_path FROM tracked WHERE user_id = ? AND status = 'watchlist' ORDER BY updated_at DESC LIMIT 6"
          )
            .bind(user.id)
            .all<WatchlistPreviewItem>()
        ).results
      : [];
  const wParam = (c.req.query("w") ?? "").split(".").map((x) => parseInt(x, 10));
  const justWatched =
    wParam.length === 3 && wParam.every(Number.isFinite)
      ? { tmdbId: wParam[0], season: wParam[1], episode: wParam[2] }
      : null;
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const upcoming = (await upcomingItems(c.env, user.id).catch(() => [] as CalendarItem[]))
    .filter((it) => it.airDate <= weekAhead)
    .slice(0, 6);
  const streakDays = await c.env.DB.prepare(
    `SELECT DISTINCT d FROM (
       SELECT date(watched_at) AS d FROM episode_watches WHERE user_id = ?1
       UNION
       SELECT date(watched_at) AS d FROM movie_watches WHERE user_id = ?1
     ) WHERE d IS NOT NULL ORDER BY d DESC LIMIT 90`
  )
    .bind(user.id)
    .all<{ d: string }>();
  const dayNums = streakDays.results.map((r) => Math.round(Date.parse(r.d + "T00:00:00Z") / 86400000));
  const todayNum = Math.floor(Date.now() / 86400000);
  let streak = 0;
  if (dayNums.length && dayNums[0] >= todayNum - 1) {
    streak = 1;
    for (let i = 0; i < dayNums.length - 1 && dayNums[i + 1] === dayNums[i] - 1; i++) streak++;
  }
  return c.html(
    <Layout user={user} title="Next up">
      <HomePage
        nextUp={nextUp}
        watchlistCount={wl?.n ?? 0}
        hasAnything={tracked.results.length > 0 || (wl?.n ?? 0) > 0}
        justWatched={justWatched}
        watchlistPreview={watchlistPreview}
        upcoming={upcoming}
        hasWatch={hasWatch}
        wrappedYear={new Date().getUTCFullYear()}
        streak={streak}
      />
    </Layout>
  );
});

app.get("/search", async (c) => {
  const user = c.get("user");
  const q = (c.req.query("q") ?? "").trim();
  if (!q) {
    const [shows, movies] = await Promise.all([trendingTv(c.env), trendingMovies(c.env)]);
    return c.html(
      <Layout user={user} title="Discover" canonical={`${c.env.SITE_URL}/search`}>
        <SearchPage q="" results={[]} />
        <TrendingSection shows={shows.results} movies={movies.results} />
      </Layout>
    );
  }
  const typeQ = c.req.query("type");
  const type = typeQ === "tv" || typeQ === "movie" || typeQ === "person" ? typeQ : "all";
  const res =
    type === "person"
      ? { results: (await searchPerson(c.env, q)).results.map((r) => ({ ...r, media_type: "person" })) }
      : await searchMulti(c.env, q);
  let libraryIds: Set<string> | undefined;
  if (user) {
    const rows = await c.env.DB.prepare("SELECT tmdb_id, media_type FROM tracked WHERE user_id = ?")
      .bind(user.id)
      .all<{ tmdb_id: number; media_type: string }>();
    libraryIds = new Set(rows.results.map((r) => `${r.media_type}:${r.tmdb_id}`));
  }
  c.executionCtx.waitUntil(
    c.env.DB.prepare("INSERT INTO search_queries (q, results) VALUES (?, ?)")
      .bind(q.trim().toLowerCase().slice(0, 200), res.results.length)
      .run()
      .catch(() => {})
  );
  const hasMedia = res.results.some((r) => r.media_type === "tv" || r.media_type === "movie" || (r.media_type === "person" && r.profile_path));
  if (!hasMedia) {
    const [shows, movies] = await Promise.all([trendingTv(c.env), trendingMovies(c.env)]);
    return c.html(
      <Layout user={user} title={`Search: ${q}`}>
        <SearchPage q={q} results={[]} type={type} />
        <TrendingSection shows={shows.results} movies={movies.results} />
      </Layout>
    );
  }
  return c.html(
    <Layout user={user} title={`Search: ${q}`}>
      <SearchPage q={q} results={res.results} libraryIds={libraryIds} type={type} loggedIn={!!user} />
    </Layout>
  );
});

app.get("/api/suggest", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 2) return c.json({ results: [] });
  const res = await searchMulti(c.env, q);
  const results = res.results
    .filter((r) =>
      r.media_type === "person" ? !!r.profile_path : (r.media_type === "tv" || r.media_type === "movie") && !!r.poster_path
    )
    .slice(0, 8)
    .map((r) => ({
      t: r.name ?? r.title ?? "",
      y: (r.first_air_date ?? r.release_date ?? "").slice(0, 4),
      m: r.media_type,
      u:
        r.media_type === "person"
          ? `/person/${r.id}-${slugify(r.name ?? "")}`
          : `/${r.media_type === "tv" ? "shows" : "movies"}/${r.id}-${slugify(r.name ?? r.title ?? "")}`,
      p: r.media_type === "person" ? r.profile_path : r.poster_path,
    }));
  c.header("cache-control", "public, max-age=300");
  return c.json({ results });
});

app.get("/shows", (c) => c.redirect("/browse/trending/tv", 301));
app.get("/movies", (c) => c.redirect("/browse/trending/movie", 301));
app.get("/show/:idslug", (c) => c.redirect(`/shows/${c.req.param("idslug")}${new URL(c.req.url).search}`, 301));
app.get("/movie/:idslug", (c) => c.redirect(`/movies/${c.req.param("idslug")}${new URL(c.req.url).search}`, 301));
app.get("/tv/:idslug", (c) => c.redirect(`/shows/${c.req.param("idslug")}${new URL(c.req.url).search}`, 301));

app.get("/shows/:idslug", async (c) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("idslug"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  let show;
  try {
    show = await tvDetails(c.env, id);
  } catch {
    return c.notFound();
  }
  const showSlug = `${show.id}-${slugify(show.name)}`;
  if (c.req.param("idslug") !== showSlug) {
    const qs = new URL(c.req.url).search;
    return c.redirect(`/shows/${showSlug}${qs}`, 301);
  }
  const seasonNum = parseInt(c.req.query("season") ?? "1", 10) || 1;
  const [season, watchedRows, tracked, recsRes, providers, cast, trailer, services, listsRes] = await Promise.all([
    seasonDetails(c.env, id, seasonNum).catch(() => null),
    user
      ? c.env.DB.prepare("SELECT season, episode, plays, rating FROM episode_watches WHERE user_id = ? AND tmdb_id = ?")
          .bind(user.id, id)
          .all<{ season: number; episode: number; plays: number; rating: number | null }>()
      : Promise.resolve(null),
    user
      ? c.env.DB.prepare("SELECT status, rating, notes FROM tracked WHERE user_id = ? AND tmdb_id = ? AND media_type = 'tv'")
          .bind(user.id, id)
          .first<{ status: string; rating: number | null; notes: string | null }>()
      : Promise.resolve(null),
    recommendations(c.env, "tv", id).catch(() => ({ results: [] as SearchResult[] })),
    watchProviders(c.env, "tv", id, (c.req.raw as { cf?: { country?: string } }).cf?.country ?? "US").catch(() => null),
    topCast(c.env, "tv", id).catch(() => [] as CastMember[]),
    trailerUrl(c.env, "tv", id).catch(() => null),
    user ? userServices(c.env, user.id) : Promise.resolve(new Set<number>()),
    user ? userLists(c.env, user.id, id, "tv") : Promise.resolve(null),
  ]);
  const watched = new Set((watchedRows?.results ?? []).map((r) => `${r.season}x${r.episode}`));
  const plays = new Map((watchedRows?.results ?? []).map((r) => [`${r.season}x${r.episode}`, r.plays]));
  const epRatings = new Map((watchedRows?.results ?? []).filter((r) => r.rating != null).map((r) => [`${r.season}x${r.episode}`, r.rating as number]));
  const recs = recsRes.results;
  const showCanonical = `${c.env.SITE_URL}/shows/${show.id}-${slugify(show.name)}`;
  return c.html(
    <Layout
      user={user}
      title={show.name}
      description={metaDescription(show.overview)}
      canonical={showCanonical}
      ogImage={show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : undefined}
      ogType="video.tv_show"
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "TVSeries",
            name: show.name,
            url: showCanonical,
            ...(show.overview ? { description: show.overview } : {}),
            ...(show.poster_path ? { image: `https://image.tmdb.org/t/p/w500${show.poster_path}` } : {}),
            ...(show.first_air_date ? { datePublished: show.first_air_date } : {}),
            ...(show.number_of_seasons ? { numberOfSeasons: show.number_of_seasons } : {}),
            ...(show.genres?.length ? { genre: show.genres.map((g) => g.name) } : {}),
            ...(show.vote_average && show.vote_count
              ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Math.round(show.vote_average * 10) / 10, bestRating: 10, worstRating: 0, ratingCount: show.vote_count } }
              : {}),
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "WatchDeck", item: c.env.SITE_URL + "/" },
              { "@type": "ListItem", position: 2, name: "Browse", item: c.env.SITE_URL + "/browse" },
              { "@type": "ListItem", position: 3, name: show.name, item: showCanonical },
            ],
          },
        ],
      }}
    >
      <ShowPage show={show} season={season} watched={watched} plays={plays} epRatings={epRatings} tracked={tracked} user={user} recs={recs} providers={providers} cast={cast} trailer={trailer} myServices={services} lists={listsRes?.results ?? []} />
    </Layout>
  );
});

app.get("/movies/:idslug", async (c) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("idslug"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  let movie;
  try {
    movie = await movieDetails(c.env, id);
  } catch {
    return c.notFound();
  }
  const movieSlug = `${movie.id}-${slugify(movie.title)}`;
  if (c.req.param("idslug") !== movieSlug) return c.redirect(`/movies/${movieSlug}`, 301);
  const [watchedRow, tracked, recsRes, providers, cast, trailer, directors, services, listsRes, collectionRes] = await Promise.all([
    user ? c.env.DB.prepare("SELECT COUNT(*) AS n FROM movie_watches WHERE user_id = ? AND tmdb_id = ?").bind(user.id, id).first<{ n: number }>() : Promise.resolve(null),
    user
      ? c.env.DB.prepare("SELECT status, rating, notes FROM tracked WHERE user_id = ? AND tmdb_id = ? AND media_type = 'movie'")
          .bind(user.id, id)
          .first<{ status: string; rating: number | null; notes: string | null }>()
      : Promise.resolve(null),
    recommendations(c.env, "movie", id).catch(() => ({ results: [] as SearchResult[] })),
    watchProviders(c.env, "movie", id, (c.req.raw as { cf?: { country?: string } }).cf?.country ?? "US").catch(() => null),
    topCast(c.env, "movie", id).catch(() => [] as CastMember[]),
    trailerUrl(c.env, "movie", id).catch(() => null),
    movieDirectors(c.env, id).catch(() => [] as { id: number; name: string }[]),
    user ? userServices(c.env, user.id) : Promise.resolve(new Set<number>()),
    user ? userLists(c.env, user.id, id, "movie") : Promise.resolve(null),
    movie.belongs_to_collection
      ? collectionDetails(c.env, movie.belongs_to_collection.id).catch(() => null)
      : Promise.resolve(null),
  ]);
  const watchCount = watchedRow?.n ?? 0;
  const recs = recsRes.results;
  const collection = collectionRes
    ? {
        name: collectionRes.name,
        parts: collectionRes.parts
          .filter((p) => p.id !== id && p.poster_path)
          .sort((a, b) => (a.release_date ?? "9999").localeCompare(b.release_date ?? "9999")),
      }
    : null;
  const movieCanonical = `${c.env.SITE_URL}/movies/${movie.id}-${slugify(movie.title)}`;
  return c.html(
    <Layout
      user={user}
      title={movie.title}
      description={metaDescription(movie.overview)}
      canonical={movieCanonical}
      ogImage={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : undefined}
      ogType="video.movie"
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Movie",
            name: movie.title,
            url: movieCanonical,
            ...(movie.overview ? { description: movie.overview } : {}),
            ...(movie.poster_path ? { image: `https://image.tmdb.org/t/p/w500${movie.poster_path}` } : {}),
            ...(movie.release_date ? { datePublished: movie.release_date } : {}),
            ...(movie.genres?.length ? { genre: movie.genres.map((g) => g.name) } : {}),
            ...(movie.vote_average && movie.vote_count
              ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Math.round(movie.vote_average * 10) / 10, bestRating: 10, worstRating: 0, ratingCount: movie.vote_count } }
              : {}),
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "WatchDeck", item: c.env.SITE_URL + "/" },
              { "@type": "ListItem", position: 2, name: "Browse", item: c.env.SITE_URL + "/browse" },
              { "@type": "ListItem", position: 3, name: movie.title, item: movieCanonical },
            ],
          },
        ],
      }}
    >
      <MoviePage movie={movie} watchCount={watchCount} tracked={tracked} user={user} recs={recs} providers={providers} cast={cast} trailer={trailer} myServices={services} lists={listsRes?.results ?? []} directors={directors} collection={collection} />
    </Layout>
  );
});

app.get("/person/:idslug", async (c) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("idslug"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  let person;
  try {
    person = await personDetails(c.env, id);
  } catch {
    return c.notFound();
  }
  const personSlug = `${person.id}-${slugify(person.name)}`;
  if (c.req.param("idslug") !== personSlug) return c.redirect(`/person/${personSlug}`, 301);
  const credits = await personCredits(c.env, id).catch(() => []);
  const canonical = `${c.env.SITE_URL}/person/${personSlug}`;
  return c.html(
    <Layout
      user={user}
      title={person.name}
      description={metaDescription(person.biography ?? `TV shows and movies featuring ${person.name}.`)}
      canonical={canonical}
      ogType="profile"
      ogImage={person.profile_path ? `https://image.tmdb.org/t/p/w500${person.profile_path}` : undefined}
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Person",
            name: person.name,
            url: canonical,
            ...(person.profile_path ? { image: `https://image.tmdb.org/t/p/w500${person.profile_path}` } : {}),
            ...(person.birthday ? { birthDate: person.birthday } : {}),
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "WatchDeck", item: c.env.SITE_URL + "/" },
              { "@type": "ListItem", position: 2, name: "Browse", item: c.env.SITE_URL + "/browse" },
              { "@type": "ListItem", position: 3, name: person.name, item: canonical },
            ],
          },
        ],
      }}
    >
      <PersonPage person={person} credits={credits} />
    </Layout>
  );
});

app.get("/library", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const status = c.req.query("status") ?? "all";
  const q = (c.req.query("q") ?? "").trim();
  const cols =
    "tmdb_id, media_type, title, poster_path, status, rating, (SELECT COUNT(*) FROM episode_watches w WHERE w.user_id = tracked.user_id AND w.tmdb_id = tracked.tmdb_id) AS eps_watched";
  const conds = ["user_id = ?"];
  const binds: (string | number)[] = [user.id];
  if (status !== "all") {
    conds.push("status = ?");
    binds.push(status);
  }
  if (q) {
    conds.push("title LIKE ? COLLATE NOCASE");
    binds.push(`%${q}%`);
  }
  const sort = ["recent", "title", "progress", "rating"].includes(c.req.query("sort") ?? "") ? c.req.query("sort")! : "recent";
  const orderBy =
    sort === "title"
      ? "title COLLATE NOCASE ASC"
      : sort === "progress"
        ? "eps_watched DESC, updated_at DESC"
        : sort === "rating"
          ? "rating IS NULL, rating DESC, updated_at DESC"
          : "updated_at DESC";
  const perPage = 120;
  const [filteredTotal, countRows] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM tracked WHERE ${conds.join(" AND ")}`).bind(...binds).first<{ n: number }>(),
    c.env.DB.prepare("SELECT status, COUNT(*) AS n FROM tracked WHERE user_id = ? GROUP BY status")
      .bind(user.id)
      .all<{ status: string; n: number }>(),
  ]);
  const total = filteredTotal?.n ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(lastPage, Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1));
  const [rows, services] = await Promise.all([
    c.env.DB.prepare(
      `SELECT ${cols} FROM tracked WHERE ${conds.join(" AND ")} ORDER BY ${orderBy} LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`
    )
      .bind(...binds)
      .all<LibraryRow>(),
    userServices(c.env, user.id),
  ]);
  const counts = Object.fromEntries(countRows.results.map((r) => [r.status, r.n]));
  const avail = c.req.query("avail") === "mine" && services.size > 0;
  let shown = rows.results;
  let availCapped = false;
  if (avail) {
    const capped = shown.slice(0, 30);
    availCapped = shown.length > 30;
    const provs = await Promise.all(capped.map((r) => watchProviders(c.env, r.media_type, r.tmdb_id).catch(() => null)));
    shown = capped.filter((_, i) => provs[i]?.providers.flatrate?.some((p) => services.has(p.provider_id)));
  }
  return c.html(
    <Layout user={user} title="Library">
      <LibraryPage rows={shown} status={status} sort={sort} q={q} counts={counts} page={page} lastPage={avail ? 1 : lastPage} avail={avail} hasServices={services.size > 0} availCapped={availCapped} />
    </Layout>
  );
});

async function upcomingItems(env: AppContext["Bindings"], userId: number): Promise<CalendarItem[]> {
  const tracked = await env.DB.prepare(
    "SELECT tmdb_id, media_type FROM tracked WHERE user_id = ? AND status IN ('watching','watchlist') LIMIT 40"
  )
    .bind(userId)
    .all<{ tmdb_id: number; media_type: "tv" | "movie" }>();
  const todayIso = new Date().toISOString().slice(0, 10);
  const perItem = await Promise.all(
    tracked.results.map(async (t): Promise<CalendarItem | null> => {
      try {
        if (t.media_type === "tv") {
          const d = await tvDetails(env, t.tmdb_id);
          if (!d.next_episode_to_air?.air_date || d.next_episode_to_air.air_date < todayIso) return null;
          return {
            tmdbId: d.id,
            title: d.name,
            posterPath: d.poster_path,
            mediaType: "tv",
            season: d.next_episode_to_air.season_number,
            episode: d.next_episode_to_air.episode_number,
            episodeName: d.next_episode_to_air.name,
            episodeType: d.next_episode_to_air.episode_type,
            airDate: d.next_episode_to_air.air_date,
          };
        }
        const m = await movieDetails(env, t.tmdb_id);
        if (!m.release_date || m.release_date < todayIso) return null;
        return {
          tmdbId: m.id,
          title: m.title,
          posterPath: m.poster_path,
          mediaType: "movie",
          season: null,
          episode: null,
          episodeName: null,
          airDate: m.release_date,
        };
      } catch {
        return null;
      }
    })
  );
  const items = perItem.filter((i): i is CalendarItem => i !== null);
  items.sort((a, b) => a.airDate.localeCompare(b.airDate));
  return items;
}

app.get("/calendar", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  let feed = await c.env.DB.prepare("SELECT token FROM feed_tokens WHERE user_id = ?").bind(user.id).first<{ token: string }>();
  if (!feed) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    await c.env.DB.prepare("INSERT OR IGNORE INTO feed_tokens (token, user_id) VALUES (?, ?)").bind(token, user.id).run();
    feed = { token };
  }
  const items = await upcomingItems(c.env, user.id);
  return c.html(
    <Layout user={user} title="Calendar">
      <CalendarPage items={items} feedUrl={`/feed/${feed.token}.ics`} remindEmail={user.remind_email === 1} />
    </Layout>
  );
});

app.post("/api/feed/rotate", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM feed_tokens WHERE user_id = ?").bind(user.id),
    c.env.DB.prepare("INSERT INTO feed_tokens (token, user_id) VALUES (?, ?)").bind(token, user.id),
  ]);
  return c.redirect("/calendar");
});

app.get("/feed/:token", async (c) => {
  const token = c.req.param("token").replace(/\.ics$/, "");
  if (!/^[0-9a-f]{32}$/.test(token)) return c.notFound();
  const row = await c.env.DB.prepare("SELECT user_id FROM feed_tokens WHERE token = ?").bind(token).first<{ user_id: number }>();
  if (!row) return c.notFound();
  const items = await upcomingItems(c.env, row.user_id);
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WatchDeck//Upcoming Episodes//EN",
    "X-WR-CALNAME:WatchDeck \u2014 Upcoming episodes",
  ];
  for (const it of items) {
    const day = it.airDate.replace(/-/g, "");
    const isTv = it.mediaType === "tv" && it.season != null && it.episode != null;
    lines.push(
      "BEGIN:VEVENT",
      isTv ? `UID:wd-${it.tmdbId}-s${it.season}e${it.episode}@watchdeck.zalize.com` : `UID:wd-m-${it.tmdbId}@watchdeck.zalize.com`,
      `DTSTART;VALUE=DATE:${day}`,
      `SUMMARY:${esc(isTv ? `${it.title} S${String(it.season).padStart(2, "0")}E${String(it.episode).padStart(2, "0")}${it.episodeName ? ` \u2014 ${it.episodeName}` : ""}` : `${it.title} \u2014 movie release`)}`,
      `URL:${c.env.SITE_URL}/${isTv ? "shows" : "movies"}/${it.tmdbId}-${slugify(it.title)}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return c.body(lines.join("\r\n") + "\r\n", 200, {
    "content-type": "text/calendar; charset=utf-8",
    "cache-control": "private, max-age=3600",
  });
});

function browseYears(): number[] {
  const current = new Date().getUTCFullYear();
  return Array.from({ length: 15 }, (_, i) => current - i);
}

function browseCrumbs(siteUrl: string, name: string, item: string, results?: SearchResult[], type?: "tv" | "movie") {
  const crumbs = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "WatchDeck", item: siteUrl + "/" },
      { "@type": "ListItem", position: 2, name: "Browse", item: siteUrl + "/browse" },
      { "@type": "ListItem", position: 3, name, item },
    ],
  };
  if (!results?.length || !type) return { "@context": "https://schema.org", ...crumbs };
  return {
    "@context": "https://schema.org",
    "@graph": [
      crumbs,
      {
        "@type": "ItemList",
        name,
        itemListElement: results.slice(0, 20).map((r, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: (type === "tv" ? r.name : r.title) ?? "",
          url: `${siteUrl}/${type === "tv" ? "shows" : "movies"}/${r.id}-${slugify((type === "tv" ? r.name : r.title) ?? "")}`,
        })),
      },
    ],
  };
}

app.get("/browse", async (c) => {
  const [tv, movie, ppl] = await Promise.all([
    genreList(c.env, "tv"),
    genreList(c.env, "movie"),
    popularPeople(c.env, 1).catch(() => ({ results: [] })),
  ]);
  const people = ppl.results.filter((p) => p.profile_path).slice(0, 12);
  return c.html(
    <Layout
      user={c.get("user")}
      title="Browse TV shows & movies by genre"
      description="Explore popular TV shows and movies by genre and start tracking them on WatchDeck."
      canonical={`${c.env.SITE_URL}/browse`}
    >
      <BrowseIndex tvGenres={tv.genres} movieGenres={movie.genres} networks={NETWORKS} years={browseYears()} people={people} />
    </Layout>
  );
});

app.get("/browse/network/:idslug", async (c) => {
  const id = parseInt(c.req.param("idslug"), 10);
  const network = NETWORKS.find((n) => n.id === id);
  if (!network) return c.notFound();
  const page = Math.min(20, Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1));
  const res = await discoverByNetwork(c.env, network.id, page);
  const base = `${c.env.SITE_URL}/browse/network/${network.id}-${slugify(network.name)}`;
  const last = Math.min(res.total_pages, 20);
  return c.html(
    <Layout
      user={c.get("user")}
      title={`${network.name} TV shows to watch`}
      description={`Popular TV shows on ${network.name} to discover and track on WatchDeck.`}
      canonical={page === 1 ? base : `${base}?page=${page}`}
      prev={page > 1 ? (page === 2 ? base : `${base}?page=${page - 1}`) : undefined}
      next={page < last ? `${base}?page=${page + 1}` : undefined}
      jsonLd={browseCrumbs(c.env.SITE_URL, network.name, base, res.results, "tv")}
    >
      <BrowseNetwork network={network} results={res.results} page={page} totalPages={res.total_pages} />
    </Layout>
  );
});

const CHART_OG: Record<string, { title: string; description: string }> = {
  "trending-tv": { title: "Trending TV shows this week", description: "What everyone is watching right now, refreshed weekly." },
  "trending-movie": { title: "Trending movies this week", description: "The movies everyone is watching right now, refreshed weekly." },
  "top-rated-tv": { title: "Top rated TV shows of all time", description: "The highest-rated series ever, ranked by viewer ratings." },
  "top-rated-movie": { title: "Top rated movies of all time", description: "The highest-rated films ever, ranked by viewer ratings." },
  "on-the-air-tv": { title: "TV shows on the air right now", description: "Series with new episodes airing in the next 7 days." },
  "coming-soon-movie": { title: "Movies coming soon to theaters", description: "Upcoming theatrical releases to watchlist before the big screen." },
};

app.get("/og/chart/:slug{[a-z0-9-]+\\.png}", async (c) => {
  const slug = c.req.param("slug").replace(/\.png$/, "");
  const chart = CHART_OG[slug];
  if (!chart) return c.notFound();
  const cacheKey = `og:chart:${slug}:v1`;
  const cached = await c.env.CACHE.get(cacheKey, "arrayBuffer");
  if (cached) return c.body(cached, 200, { "content-type": "image/png", "cache-control": "public, max-age=86400" });
  const res = await guideOgImage(c.env, chart.title, chart.description, "WATCHDECK CHARTS");
  const buf = await res.arrayBuffer();
  c.executionCtx.waitUntil(c.env.CACHE.put(cacheKey, buf, { expirationTtl: 30 * 24 * 3600 }));
  return c.body(buf, 200, { "content-type": "image/png", "cache-control": "public, max-age=86400" });
});

app.get("/browse/trending/:type", async (c) => {
  const type = c.req.param("type") === "movie" ? "movie" : c.req.param("type") === "tv" ? "tv" : null;
  if (!type) return c.notFound();
  const page = Math.min(20, Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1));
  const fetcher = type === "tv" ? trendingTv : trendingMovies;
  const [res, prevRes] = await Promise.all([fetcher(c.env, page), page > 1 ? fetcher(c.env, page - 1) : Promise.resolve(null)]);
  if (prevRes) {
    // TMDB's trending endpoint repeats items across page boundaries
    const prevIds = new Set(prevRes.results.map((r) => r.id));
    res.results = res.results.filter((r) => !prevIds.has(r.id));
  }
  const base = `${c.env.SITE_URL}/browse/trending/${type}`;
  const last = Math.min(res.total_pages, 20);
  return c.html(
    <Layout
      user={c.get("user")}
      title={`Trending ${type === "tv" ? "TV shows" : "movies"} this week`}
      description={`The ${type === "tv" ? "TV shows" : "movies"} everyone is watching this week — discover and track them on WatchDeck.`}
      canonical={page === 1 ? base : `${base}?page=${page}`}
      prev={page > 1 ? (page === 2 ? base : `${base}?page=${page - 1}`) : undefined}
      next={page < last ? `${base}?page=${page + 1}` : undefined}
      ogImage={`${c.env.SITE_URL}/og/chart/trending-${type}.png`}
      jsonLd={browseCrumbs(c.env.SITE_URL, `Trending ${type === "tv" ? "TV shows" : "movies"}`, base, res.results, type)}
    >
      <BrowseTrending type={type} results={res.results} page={page} totalPages={res.total_pages} />
    </Layout>
  );
});

app.get("/browse/on-the-air/tv", async (c) => {
  const page = Math.min(20, Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1));
  const res = await onTheAirTv(c.env, page);
  const base = `${c.env.SITE_URL}/browse/on-the-air/tv`;
  const last = Math.min(res.total_pages, 20);
  return c.html(
    <Layout
      user={c.get("user")}
      title="TV shows on the air right now"
      description="Series with new episodes airing in the next 7 days — catch them while they're fresh and track them on WatchDeck."
      canonical={page === 1 ? base : `${base}?page=${page}`}
      prev={page > 1 ? (page === 2 ? base : `${base}?page=${page - 1}`) : undefined}
      next={page < last ? `${base}?page=${page + 1}` : undefined}
      ogImage={`${c.env.SITE_URL}/og/chart/on-the-air-tv.png`}
      jsonLd={browseCrumbs(c.env.SITE_URL, "TV shows on the air", base, res.results, "tv")}
    >
      <BrowseChartList
        heading="On the air right now"
        intro="Series with new episodes airing in the next 7 days — catch them while they're fresh."
        type="tv"
        results={res.results}
        page={page}
        totalPages={res.total_pages}
      />
    </Layout>
  );
});

app.get("/browse/coming-soon/movie", async (c) => {
  const page = Math.min(20, Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1));
  const res = await upcomingMovies(c.env, page);
  const base = `${c.env.SITE_URL}/browse/coming-soon/movie`;
  const last = Math.min(res.total_pages, 20);
  return c.html(
    <Layout
      user={c.get("user")}
      title="Movies coming soon to theaters"
      description="Upcoming theatrical releases — add them to your watchlist on WatchDeck before they hit the big screen."
      canonical={page === 1 ? base : `${base}?page=${page}`}
      prev={page > 1 ? (page === 2 ? base : `${base}?page=${page - 1}`) : undefined}
      next={page < last ? `${base}?page=${page + 1}` : undefined}
      ogImage={`${c.env.SITE_URL}/og/chart/coming-soon-movie.png`}
      jsonLd={browseCrumbs(c.env.SITE_URL, "Movies coming soon", base, res.results, "movie")}
    >
      <BrowseChartList
        heading="Coming soon to theaters"
        intro="Upcoming theatrical releases — add them to your watchlist before they hit the big screen."
        type="movie"
        results={res.results}
        page={page}
        totalPages={res.total_pages}
      />
    </Layout>
  );
});

app.get("/browse/top-rated/:type", async (c) => {
  const type = c.req.param("type") === "movie" ? "movie" : c.req.param("type") === "tv" ? "tv" : null;
  if (!type) return c.notFound();
  const page = Math.min(20, Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1));
  const res = await topRated(c.env, type, page);
  const base = `${c.env.SITE_URL}/browse/top-rated/${type}`;
  const last = Math.min(res.total_pages, 20);
  return c.html(
    <Layout
      user={c.get("user")}
      title={`Top rated ${type === "tv" ? "TV shows" : "movies"} of all time`}
      description={`The highest-rated ${type === "tv" ? "TV shows" : "movies"} of all time, ranked by viewer ratings — discover and track them on WatchDeck.`}
      canonical={page === 1 ? base : `${base}?page=${page}`}
      prev={page > 1 ? (page === 2 ? base : `${base}?page=${page - 1}`) : undefined}
      next={page < last ? `${base}?page=${page + 1}` : undefined}
      ogImage={`${c.env.SITE_URL}/og/chart/top-rated-${type}.png`}
      jsonLd={browseCrumbs(c.env.SITE_URL, `Top rated ${type === "tv" ? "TV shows" : "movies"}`, base, res.results, type)}
    >
      <BrowseTopRated type={type} results={res.results} page={page} totalPages={res.total_pages} />
    </Layout>
  );
});

app.get("/browse/year/:type/:year", async (c) => {
  const type = c.req.param("type") === "movie" ? "movie" : c.req.param("type") === "tv" ? "tv" : null;
  const year = parseInt(c.req.param("year"), 10);
  const current = new Date().getUTCFullYear();
  if (!type || !Number.isFinite(year) || year < 1950 || year > current + 1) return c.notFound();
  const page = Math.min(20, Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1));
  const res = await discoverByYear(c.env, type, year, page);
  const base = `${c.env.SITE_URL}/browse/year/${type}/${year}`;
  const last = Math.min(res.total_pages, 20);
  return c.html(
    <Layout
      user={c.get("user")}
      title={`${type === "tv" ? "TV shows" : "Movies"} of ${year}`}
      description={`The most popular ${type === "tv" ? `TV shows that premiered in ${year}` : `movies released in ${year}`} to discover and track on WatchDeck.`}
      canonical={page === 1 ? base : `${base}?page=${page}`}
      prev={page > 1 ? (page === 2 ? base : `${base}?page=${page - 1}`) : undefined}
      next={page < last ? `${base}?page=${page + 1}` : undefined}
      jsonLd={browseCrumbs(c.env.SITE_URL, `${type === "tv" ? "TV shows" : "Movies"} of ${year}`, base, res.results, type)}
    >
      <BrowseYear type={type} year={year} results={res.results} page={page} totalPages={res.total_pages} />
    </Layout>
  );
});

app.get("/browse/:type/:genreslug", async (c) => {
  const type = c.req.param("type") === "movie" ? "movie" : c.req.param("type") === "tv" ? "tv" : null;
  const genreId = parseInt(c.req.param("genreslug"), 10);
  if (!type || !Number.isFinite(genreId)) return c.notFound();
  const genres = await genreList(c.env, type);
  const genre = genres.genres.find((g) => g.id === genreId);
  if (!genre) return c.notFound();
  const page = Math.min(20, Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1));
  const res = await discoverByGenre(c.env, type, genreId, page);
  const base = `${c.env.SITE_URL}/browse/${type}/${genre.id}-${slugify(genre.name)}`;
  const last = Math.min(res.total_pages, 20);
  return c.html(
    <Layout
      user={c.get("user")}
      title={`${genre.name} ${type === "tv" ? "TV shows" : "movies"} to watch`}
      description={`Popular ${genre.name.toLowerCase()} ${type === "tv" ? "TV shows" : "movies"} to discover and track on WatchDeck.`}
      canonical={page === 1 ? base : `${base}?page=${page}`}
      prev={page > 1 ? (page === 2 ? base : `${base}?page=${page - 1}`) : undefined}
      next={page < last ? `${base}?page=${page + 1}` : undefined}
      jsonLd={browseCrumbs(c.env.SITE_URL, `${genre.name} ${type === "tv" ? "TV shows" : "movies"}`, base, res.results, type)}
    >
      <BrowseGenre type={type} genre={genre} results={res.results} page={page} totalPages={res.total_pages} />
    </Layout>
  );
});

function logFunnel(c: { env: Env; executionCtx: { waitUntil(promise: Promise<unknown>): void } }, event: string): void {
  c.executionCtx.waitUntil(
    c.env.DB.prepare("INSERT INTO analytics_events (path, referrer, country, ua_class) VALUES (?, NULL, NULL, 'funnel')")
      .bind(`/funnel/${event}`)
      .run()
      .catch(() => {})
  );
}

async function maybeAutoComplete(env: Env, userId: number, tmdbId: number, details: { status: string; number_of_episodes: number }): Promise<void> {
  if (!(details.status === "Ended" || details.status === "Canceled")) return;
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM episode_watches WHERE user_id = ? AND tmdb_id = ?")
    .bind(userId, tmdbId)
    .first<{ n: number }>();
  if ((n?.n ?? 0) >= details.number_of_episodes && details.number_of_episodes > 0) {
    await env.DB.prepare("UPDATE tracked SET status = 'completed' WHERE user_id = ? AND tmdb_id = ? AND media_type = 'tv' AND status = 'watching'")
      .bind(userId, tmdbId)
      .run();
  }
}

function invalidateHours(c: { env: Env; executionCtx: { waitUntil(promise: Promise<unknown>): void } }, userId: number): void {
  c.executionCtx.waitUntil(c.env.CACHE.delete(`hours:${userId}`).catch(() => {}));
}

async function hoursWatched(env: Env, userId: number): Promise<number> {
  const cacheKey = `hours:${userId}`;
  const cached = await env.CACHE.get(cacheKey);
  if (cached !== null) return parseInt(cached, 10);
  const [showEps, movieIds] = await Promise.all([
    env.DB.prepare("SELECT tmdb_id, SUM(plays) AS n FROM episode_watches WHERE user_id = ? GROUP BY tmdb_id")
      .bind(userId)
      .all<{ tmdb_id: number; n: number }>(),
    env.DB.prepare("SELECT tmdb_id FROM movie_watches WHERE user_id = ?").bind(userId).all<{ tmdb_id: number }>(),
  ]);
  let minutes = 0;
  const showMinutes = await Promise.all(
    showEps.results.map(async (s) => {
      try {
        const d = await tvDetails(env, s.tmdb_id);
        const runtime = d.last_episode_to_air?.runtime || d.episode_run_time?.[0] || 40;
        return s.n * runtime;
      } catch {
        return s.n * 40;
      }
    })
  );
  const movieMinutes = await Promise.all(
    movieIds.results.map(async (m) => {
      try {
        return (await movieDetails(env, m.tmdb_id)).runtime || 110;
      } catch {
        return 110;
      }
    })
  );
  minutes = [...showMinutes, ...movieMinutes].reduce((a, b) => a + b, 0);
  const hours = Math.round(minutes / 60);
  await env.CACHE.put(cacheKey, String(hours), { expirationTtl: 3600 });
  return hours;
}

async function userStats(env: Env, userId: number): Promise<UserStats> {
  const [eps, movies, tracked, completed, topShows, byMonth, hours, epsYear, moviesYear, byYear, ratingRows, watchDays, epsMonth, moviesMonth, topShowMonth, topEpisodes] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM episode_watches WHERE user_id = ?").bind(userId).first<{ n: number }>(),
    env.DB.prepare("SELECT COUNT(DISTINCT tmdb_id) AS n FROM movie_watches WHERE user_id = ?").bind(userId).first<{ n: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM tracked WHERE user_id = ? AND media_type = 'tv'").bind(userId).first<{ n: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM tracked WHERE user_id = ? AND media_type = 'tv' AND status = 'completed'").bind(userId).first<{ n: number }>(),
    env.DB.prepare(
      `SELECT t.title, t.tmdb_id, COUNT(*) AS eps FROM episode_watches w
       JOIN tracked t ON t.user_id = w.user_id AND t.tmdb_id = w.tmdb_id AND t.media_type = 'tv'
       WHERE w.user_id = ? GROUP BY w.tmdb_id ORDER BY eps DESC LIMIT 10`
    ).bind(userId).all<{ title: string; tmdb_id: number; eps: number }>(),
    env.DB.prepare(
      `SELECT strftime('%Y-%m', watched_at) AS month, COUNT(*) AS eps FROM episode_watches
       WHERE user_id = ? AND watched_at >= date('now', '-12 months') GROUP BY month ORDER BY month`
    ).bind(userId).all<{ month: string; eps: number }>(),
    hoursWatched(env, userId),
    env.DB.prepare("SELECT COUNT(*) AS n FROM episode_watches WHERE user_id = ? AND watched_at >= strftime('%Y-01-01', 'now')").bind(userId).first<{ n: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM movie_watches WHERE user_id = ? AND watched_at >= strftime('%Y-01-01', 'now')").bind(userId).first<{ n: number }>(),
    env.DB.prepare(
      `SELECT y AS year, SUM(eps) AS eps, SUM(movies) AS movies FROM (
         SELECT strftime('%Y', watched_at) AS y, COUNT(*) AS eps, 0 AS movies FROM episode_watches WHERE user_id = ?1 GROUP BY y
         UNION ALL
         SELECT strftime('%Y', watched_at) AS y, 0 AS eps, COUNT(*) AS movies FROM movie_watches WHERE user_id = ?1 GROUP BY y
       ) WHERE y IS NOT NULL GROUP BY y ORDER BY y DESC LIMIT 15`
    ).bind(userId).all<{ year: string; eps: number; movies: number }>(),
    env.DB.prepare(
      "SELECT rating, COUNT(*) AS n FROM tracked WHERE user_id = ? AND rating IS NOT NULL GROUP BY rating"
    ).bind(userId).all<{ rating: number; n: number }>(),
    env.DB.prepare(
      `SELECT DISTINCT d FROM (
         SELECT date(watched_at) AS d FROM episode_watches WHERE user_id = ?1
         UNION
         SELECT date(watched_at) AS d FROM movie_watches WHERE user_id = ?1
       ) WHERE d IS NOT NULL ORDER BY d`
    ).bind(userId).all<{ d: string }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM episode_watches WHERE user_id = ? AND watched_at >= strftime('%Y-%m-01', 'now')").bind(userId).first<{ n: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM movie_watches WHERE user_id = ? AND watched_at >= strftime('%Y-%m-01', 'now')").bind(userId).first<{ n: number }>(),
    env.DB.prepare(
      `SELECT t.title, COUNT(*) AS eps FROM episode_watches w
       JOIN tracked t ON t.user_id = w.user_id AND t.tmdb_id = w.tmdb_id AND t.media_type = 'tv'
       WHERE w.user_id = ? AND w.watched_at >= strftime('%Y-%m-01', 'now')
       GROUP BY w.tmdb_id ORDER BY eps DESC, t.title LIMIT 1`
    ).bind(userId).first<{ title: string; eps: number }>(),
    env.DB.prepare(
      `SELECT t.title, w.tmdb_id, w.season, w.episode, w.rating FROM episode_watches w
       JOIN tracked t ON t.user_id = w.user_id AND t.tmdb_id = w.tmdb_id AND t.media_type = 'tv'
       WHERE w.user_id = ? AND w.rating IS NOT NULL
       ORDER BY w.rating DESC, w.watched_at DESC LIMIT 5`
    ).bind(userId).all<{ title: string; tmdb_id: number; season: number; episode: number; rating: number }>(),
  ]);
  const ratingCounts = [1, 2, 3, 4, 5].map((r) => ratingRows.results.find((row) => row.rating === r)?.n ?? 0);
  const days = watchDays.results.map((r) => Math.round(Date.parse(r.d + "T00:00:00Z") / 86400000));
  let bestStreak = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1] + 1 ? run + 1 : 1;
    if (run > bestStreak) bestStreak = run;
  }
  const todayNum = Math.floor(Date.now() / 86400000);
  let currentStreak = 0;
  if (days.length && days[days.length - 1] >= todayNum - 1) {
    currentStreak = 1;
    for (let i = days.length - 1; i > 0 && days[i - 1] === days[i] - 1; i--) currentStreak++;
  }
  const items = await env.DB.prepare(
    "SELECT tmdb_id, media_type FROM tracked WHERE user_id = ? ORDER BY updated_at DESC LIMIT 40"
  )
    .bind(userId)
    .all<{ tmdb_id: number; media_type: "tv" | "movie" }>();
  const genreCounts = new Map<string, number>();
  await Promise.all(
    items.results.map(async (t) => {
      try {
        const d = t.media_type === "tv" ? await tvDetails(env, t.tmdb_id) : await movieDetails(env, t.tmdb_id);
        for (const g of d.genres ?? []) genreCounts.set(g.name, (genreCounts.get(g.name) ?? 0) + 1);
      } catch {}
    })
  );
  const topGenres = [...genreCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 6);
  return {
    hoursWatched: hours,
    epsWatched: eps?.n ?? 0,
    moviesWatched: movies?.n ?? 0,
    showsTracked: tracked?.n ?? 0,
    completedShows: completed?.n ?? 0,
    topShows: topShows.results,
    byMonth: byMonth.results,
    byYear: byYear.results,
    ratingCounts,
    topGenres,
    epsThisYear: epsYear?.n ?? 0,
    moviesThisYear: moviesYear?.n ?? 0,
    epsThisMonth: epsMonth?.n ?? 0,
    moviesThisMonth: moviesMonth?.n ?? 0,
    topShowThisMonth: topShowMonth ?? null,
    currentStreak,
    bestStreak,
    topEpisodes: topEpisodes.results,
  };
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

async function wrappedStats(env: Env, userId: number, year: number): Promise<WrappedStats> {
  const y = String(year);
  const [epsRow, movieRows, topShowRows, monthRows, dayRows, showRatings, epRatings, firstEp, firstMovie] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n, SUM(plays) AS plays FROM episode_watches WHERE user_id = ? AND strftime('%Y', watched_at) = ?").bind(userId, y).first<{ n: number; plays: number | null }>(),
    env.DB.prepare("SELECT tmdb_id FROM movie_watches WHERE user_id = ? AND strftime('%Y', watched_at) = ?").bind(userId, y).all<{ tmdb_id: number }>(),
    env.DB.prepare(
      `SELECT t.title, w.tmdb_id, COUNT(*) AS eps FROM episode_watches w
       JOIN tracked t ON t.user_id = w.user_id AND t.tmdb_id = w.tmdb_id AND t.media_type = 'tv'
       WHERE w.user_id = ? AND strftime('%Y', w.watched_at) = ? GROUP BY w.tmdb_id ORDER BY eps DESC, t.title LIMIT 5`
    ).bind(userId, y).all<{ title: string; tmdb_id: number; eps: number }>(),
    env.DB.prepare(
      `SELECT m AS month, COUNT(*) AS n FROM (
         SELECT strftime('%m', watched_at) AS m FROM episode_watches WHERE user_id = ?1 AND strftime('%Y', watched_at) = ?2
         UNION ALL
         SELECT strftime('%m', watched_at) AS m FROM movie_watches WHERE user_id = ?1 AND strftime('%Y', watched_at) = ?2
       ) GROUP BY m ORDER BY m`
    ).bind(userId, y).all<{ month: string; n: number }>(),
    env.DB.prepare(
      `SELECT DISTINCT d FROM (
         SELECT date(watched_at) AS d FROM episode_watches WHERE user_id = ?1 AND strftime('%Y', watched_at) = ?2
         UNION
         SELECT date(watched_at) AS d FROM movie_watches WHERE user_id = ?1 AND strftime('%Y', watched_at) = ?2
       ) WHERE d IS NOT NULL ORDER BY d`
    ).bind(userId, y).all<{ d: string }>(),
    env.DB.prepare(
      `SELECT t.title, t.rating FROM tracked t
       WHERE t.user_id = ?1 AND t.rating IS NOT NULL AND t.tmdb_id IN (
         SELECT tmdb_id FROM episode_watches WHERE user_id = ?1 AND strftime('%Y', watched_at) = ?2
         UNION SELECT tmdb_id FROM movie_watches WHERE user_id = ?1 AND strftime('%Y', watched_at) = ?2
       ) ORDER BY t.rating DESC, t.title LIMIT 1`
    ).bind(userId, y).first<{ title: string; rating: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n, AVG(rating) AS avg FROM episode_watches WHERE user_id = ? AND strftime('%Y', watched_at) = ? AND rating IS NOT NULL").bind(userId, y).first<{ n: number; avg: number | null }>(),
    env.DB.prepare(
      `SELECT t.title, date(w.watched_at) AS d FROM episode_watches w
       JOIN tracked t ON t.user_id = w.user_id AND t.tmdb_id = w.tmdb_id AND t.media_type = 'tv'
       WHERE w.user_id = ? AND strftime('%Y', w.watched_at) = ? ORDER BY w.watched_at LIMIT 1`
    ).bind(userId, y).first<{ title: string; d: string }>(),
    env.DB.prepare(
      `SELECT t.title, date(w.watched_at) AS d FROM movie_watches w
       JOIN tracked t ON t.user_id = w.user_id AND t.tmdb_id = w.tmdb_id AND t.media_type = 'movie'
       WHERE w.user_id = ? AND strftime('%Y', w.watched_at) = ? ORDER BY w.watched_at LIMIT 1`
    ).bind(userId, y).first<{ title: string; d: string }>(),
  ]);
  const dayNums = dayRows.results.map((r) => Math.round(Date.parse(r.d + "T00:00:00Z") / 86400000));
  let bestStreak = 0;
  let run = 0;
  for (let i = 0; i < dayNums.length; i++) {
    run = i > 0 && dayNums[i] === dayNums[i - 1] + 1 ? run + 1 : 1;
    if (run > bestStreak) bestStreak = run;
  }
  const topShows = await Promise.all(
    topShowRows.results.map(async (s) => {
      try {
        const d = await tvDetails(env, s.tmdb_id);
        return { ...s, poster_path: d.poster_path };
      } catch {
        return { ...s, poster_path: null };
      }
    })
  );
  // hours + genres from this year's distinct shows and movies
  const showEps = await env.DB.prepare(
    "SELECT tmdb_id, SUM(plays) AS n FROM episode_watches WHERE user_id = ? AND strftime('%Y', watched_at) = ? GROUP BY tmdb_id"
  ).bind(userId, y).all<{ tmdb_id: number; n: number }>();
  const genreCounts = new Map<string, number>();
  let minutes = 0;
  await Promise.all([
    ...showEps.results.map(async (s) => {
      try {
        const d = await tvDetails(env, s.tmdb_id);
        minutes += s.n * (d.last_episode_to_air?.runtime || d.episode_run_time?.[0] || 40);
        for (const g of d.genres ?? []) genreCounts.set(g.name, (genreCounts.get(g.name) ?? 0) + s.n);
      } catch {
        minutes += s.n * 40;
      }
    }),
    ...movieRows.results.map(async (m) => {
      try {
        const d = await movieDetails(env, m.tmdb_id);
        minutes += d.runtime || 110;
        for (const g of d.genres ?? []) genreCounts.set(g.name, (genreCounts.get(g.name) ?? 0) + 1);
      } catch {
        minutes += 110;
      }
    }),
  ]);
  const topGenres = [...genreCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 5);
  const byMonth = monthRows.results.map((m) => ({ month: parseInt(m.month, 10), count: m.n }));
  const busiest = byMonth.reduce<{ month: number; count: number } | null>((best, m) => (best && best.count >= m.count ? best : m), null);
  const firstWatch = [firstEp, firstMovie].filter((f): f is { title: string; d: string } => !!f).sort((a, b) => a.d.localeCompare(b.d))[0] ?? null;
  return {
    year,
    eps: epsRow?.n ?? 0,
    movies: movieRows.results.length,
    hours: Math.round(minutes / 60),
    days: dayNums.length,
    bestStreak,
    topShows,
    topGenres,
    byMonth,
    busiestMonth: busiest ? { month: MONTH_NAMES[busiest.month - 1], count: busiest.count } : null,
    ratingsGiven: epRatings?.n ?? 0,
    avgEpisodeRating: epRatings?.avg != null ? Math.round(epRatings.avg * 10) / 10 : null,
    topRated: showRatings ?? null,
    firstWatch: firstWatch ? { title: firstWatch.title, date: firstWatch.d } : null,
  };
}

function wrappedYear(raw: string | undefined): number | null {
  const year = parseInt(raw ?? "", 10);
  const current = new Date().getUTCFullYear();
  return Number.isFinite(year) && year >= 2000 && year <= current ? year : null;
}

app.get("/wrapped", (c) => c.redirect(`/wrapped/${new Date().getUTCFullYear()}`));

app.get("/wrapped/:year", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const year = wrappedYear(c.req.param("year"));
  if (!year) return c.notFound();
  const [stats, share, years] = await Promise.all([
    wrappedStats(c.env, user.id, year),
    c.env.DB.prepare("SELECT token FROM wrapped_shares WHERE user_id = ? AND year = ?").bind(user.id, year).first<{ token: string }>(),
    c.env.DB.prepare(
      `SELECT DISTINCT y FROM (
         SELECT strftime('%Y', watched_at) AS y FROM episode_watches WHERE user_id = ?1
         UNION SELECT strftime('%Y', watched_at) AS y FROM movie_watches WHERE user_id = ?1
       ) WHERE y IS NOT NULL ORDER BY y DESC LIMIT 15`
    ).bind(user.id).all<{ y: string }>(),
  ]);
  return c.html(
    <Layout user={user} title={`Your ${year} Wrapped`}>
      <WrappedPage stats={stats} name={user.display_name || user.email.split("@")[0]} shareUrl={share ? `${c.env.SITE_URL}/w/${share.token}` : null} years={years.results.map((r) => parseInt(r.y, 10))} />
    </Layout>
  );
});

app.post("/api/wrapped/share", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const year = wrappedYear(String(form.year ?? ""));
  if (!year) return c.redirect("/wrapped");
  if (form.enabled === "1") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    await c.env.DB.prepare("INSERT OR IGNORE INTO wrapped_shares (token, user_id, year) VALUES (?, ?, ?)").bind(token, user.id, year).run();
  } else {
    await c.env.DB.prepare("DELETE FROM wrapped_shares WHERE user_id = ? AND year = ?").bind(user.id, year).run();
  }
  return c.redirect(`/wrapped/${year}`);
});

async function wrappedShare(env: Env, token: string): Promise<{ name: string; stats: WrappedStats } | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const row = await env.DB.prepare(
    "SELECT u.id, u.display_name, u.email, s.year FROM wrapped_shares s JOIN users u ON u.id = s.user_id WHERE s.token = ?"
  ).bind(token).first<{ id: number; display_name: string | null; email: string; year: number }>();
  if (!row) return null;
  const stats = await wrappedStats(env, row.id, row.year);
  return { name: row.display_name || row.email.split("@")[0], stats };
}

app.get("/w/:token", async (c) => {
  const token = c.req.param("token");
  const share = await wrappedShare(c.env, token);
  if (!share) return c.notFound();
  return c.html(
    <Layout
      user={c.get("user")}
      title={`${share.name}'s ${share.stats.year} Wrapped`}
      description={`${share.stats.hours} hours, ${share.stats.eps} episodes and ${share.stats.movies} movies in ${share.stats.year} \u2014 a year in TV & film, wrapped on WatchDeck.`}
      canonical={`${c.env.SITE_URL}/w/${token}`}
      ogImage={`${c.env.SITE_URL}/w/${token}/og.png`}
    >
      <WrappedPage stats={share.stats} name={share.name} public />
    </Layout>
  );
});

app.get("/w/:token/og.png", async (c) => {
  const token = c.req.param("token");
  const share = await wrappedShare(c.env, token);
  if (!share) return c.notFound();
  const res = await wrappedOgImage(c.env, share.name, share.stats);
  res.headers.set("cache-control", "public, max-age=3600");
  return res;
});

app.post("/api/history/date", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const tmdbId = parseInt(String(form.tmdb_id), 10);
  const date = String(form.date ?? "");
  const orig = String(form.orig ?? "");
  const back = safeNext(form.redirect) ?? "/history";
  const today = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + "T00:00:00Z")) || date > today || !tmdbId) {
    return c.redirect(back);
  }
  if (String(form.kind) === "tv") {
    const season = parseInt(String(form.season), 10);
    const episode = parseInt(String(form.episode), 10);
    if (Number.isNaN(season) || Number.isNaN(episode)) return c.redirect(back);
    await c.env.DB.prepare(
      "UPDATE episode_watches SET watched_at = ? || substr(watched_at, 11) WHERE user_id = ? AND tmdb_id = ? AND season = ? AND episode = ?"
    )
      .bind(date, user.id, tmdbId, season, episode)
      .run();
  } else {
    await c.env.DB.prepare(
      "UPDATE movie_watches SET watched_at = ? || substr(watched_at, 11) WHERE id = (SELECT id FROM movie_watches WHERE user_id = ? AND tmdb_id = ? AND watched_at = ? LIMIT 1)"
    )
      .bind(date, user.id, tmdbId, orig)
      .run();
  }
  return c.redirect(back);
});

app.get("/history", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const perPage = 100;
  const total = await c.env.DB.prepare(
    "SELECT (SELECT COUNT(*) FROM episode_watches WHERE user_id = ?1) + (SELECT COUNT(*) FROM movie_watches WHERE user_id = ?1) AS n"
  )
    .bind(user.id)
    .first<{ n: number }>();
  const lastPage = Math.max(1, Math.ceil((total?.n ?? 0) / perPage));
  const page = Math.min(lastPage, Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1));
  const rows = await c.env.DB.prepare(
    `SELECT * FROM (
       SELECT 'tv' AS kind, w.tmdb_id, w.season, w.episode, w.watched_at, w.plays, t.title, t.poster_path
       FROM episode_watches w
       LEFT JOIN tracked t ON t.user_id = w.user_id AND t.tmdb_id = w.tmdb_id AND t.media_type = 'tv'
       WHERE w.user_id = ?1
       UNION ALL
       SELECT 'movie' AS kind, w.tmdb_id, NULL AS season, NULL AS episode, w.watched_at, 1 AS plays, t.title, t.poster_path
       FROM movie_watches w
       LEFT JOIN tracked t ON t.user_id = w.user_id AND t.tmdb_id = w.tmdb_id AND t.media_type = 'movie'
       WHERE w.user_id = ?1
     ) ORDER BY watched_at DESC LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`
  )
    .bind(user.id)
    .all<{ kind: "tv" | "movie"; tmdb_id: number; season: number | null; episode: number | null; watched_at: string; plays: number; title: string | null; poster_path: string | null }>();
  const items: HistoryItem[] = rows.results.map((r) => ({
    tmdbId: r.tmdb_id,
    mediaType: r.kind,
    title: r.title ?? (r.kind === "tv" ? `Show #${r.tmdb_id}` : `Movie #${r.tmdb_id}`),
    posterPath: r.poster_path,
    season: r.season,
    episode: r.episode,
    watchedAt: r.watched_at,
    plays: r.plays,
  }));
  return c.html(
    <Layout user={user} title="History">
      <HistoryPage items={items} page={page} lastPage={lastPage} />
    </Layout>
  );
});

app.get("/privacy", (c) =>
  c.html(
    <Layout user={c.get("user")} title="Privacy policy" canonical={`${c.env.SITE_URL}/privacy`}>
      <PrivacyPage />
    </Layout>
  )
);

app.get("/about", (c) =>
  c.html(
    <Layout
      user={c.get("user")}
      title="About & Press"
      description="What WatchDeck is, why it exists, and everything press needs: boilerplate, logo downloads and brand colors."
      canonical={`${c.env.SITE_URL}/about`}
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "WatchDeck",
        url: c.env.SITE_URL,
        logo: `${c.env.SITE_URL}/icon-512.png`,
        description: "WatchDeck is a web-first TV show and movie tracker, free while in beta. Import your TV Time export in one click and pick up right where you left off.",
      }}
    >
      <AboutPage />
    </Layout>
  )
);

app.get("/guides", (c) =>
  c.html(
    <Layout
      user={c.get("user")}
      title="Guides"
      description="Practical guides for moving your watch history: TV Time exports, Netflix imports and tracker comparisons."
      canonical={`${c.env.SITE_URL}/guides`}
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: GUIDES.map((g, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: g.title,
          url: `${c.env.SITE_URL}/guides/${g.slug}`,
        })),
      }}
    >
      <GuidesIndexPage />
    </Layout>
  )
);

app.get("/og/guide/:slug{[a-z0-9-]+\\.png}", async (c) => {
  const slug = c.req.param("slug").replace(/\.png$/, "");
  const guide = GUIDES.find((g) => g.slug === slug);
  if (!guide) return c.notFound();
  const cacheKey = `og:guide:${guide.slug}:${guide.updated}`;
  const cached = await c.env.CACHE.get(cacheKey, "arrayBuffer");
  if (cached) return c.body(cached, 200, { "content-type": "image/png", "cache-control": "public, max-age=86400" });
  const res = await guideOgImage(c.env, guide.title, guide.description);
  const buf = await res.arrayBuffer();
  c.executionCtx.waitUntil(c.env.CACHE.put(cacheKey, buf, { expirationTtl: 30 * 24 * 3600 }));
  return c.body(buf, 200, { "content-type": "image/png", "cache-control": "public, max-age=86400" });
});

app.get("/guides/:slug", (c) => {
  const guide = GUIDES.find((g) => g.slug === c.req.param("slug"));
  if (!guide) return c.notFound();
  return c.html(
    <Layout
      user={c.get("user")}
      title={guide.title}
      description={guide.description}
      canonical={`${c.env.SITE_URL}/guides/${guide.slug}`}
      ogImage={`${c.env.SITE_URL}/og/guide/${guide.slug}.png`}
      ogType="article"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: guide.title,
        description: guide.description,
        dateModified: new Date(guide.updated).toISOString().slice(0, 10),
        author: { "@type": "Organization", name: "WatchDeck" },
        mainEntityOfPage: `${c.env.SITE_URL}/guides/${guide.slug}`,
      }}
    >
      <GuidePage guide={guide} />
    </Layout>
  );
});

app.get("/terms", (c) =>
  c.html(
    <Layout user={c.get("user")} title="Terms of service" canonical={`${c.env.SITE_URL}/terms`}>
      <TermsPage />
    </Layout>
  )
);

app.get("/pricing", (c) =>
  c.html(
    <Layout
      user={c.get("user")}
      title="Pricing"
      description="WatchDeck pricing: a free plan plus a Plus plan from $1.99/month. Everything is free while WatchDeck is in beta — no payment required."
      canonical={`${c.env.SITE_URL}/pricing`}
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "WatchDeck",
        url: c.env.SITE_URL,
        applicationCategory: "EntertainmentApplication",
        operatingSystem: "Web",
        offers: [
          { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
          { "@type": "Offer", name: "Plus (monthly)", price: "1.99", priceCurrency: "USD" },
          { "@type": "Offer", name: "Plus (yearly)", price: "19", priceCurrency: "USD" },
        ],
      }}
    >
      <PricingPage loggedIn={!!c.get("user")} />
    </Layout>
  )
);

app.get("/more", (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  return c.html(
    <Layout user={user} title="More">
      <MorePage />
    </Layout>
  );
});

app.get("/settings", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const saved = c.req.query("saved") ?? undefined;
  const error = c.req.query("error") ?? undefined;
  const services = await userServices(c.env, user.id);
  return c.html(
    <Layout user={user} title="Settings">
      <SettingsPage user={user} saved={saved} error={error} services={services} />
    </Layout>
  );
});

app.get("/api/export", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const [tracked, episodes, movies] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT tmdb_id, media_type, title, status, rating, notes, created_at, updated_at FROM tracked WHERE user_id = ? ORDER BY title").bind(user.id),
    c.env.DB.prepare("SELECT tmdb_id, season, episode, watched_at, plays, rating FROM episode_watches WHERE user_id = ? ORDER BY tmdb_id, season, episode").bind(user.id),
    c.env.DB.prepare("SELECT tmdb_id, watched_at FROM movie_watches WHERE user_id = ? ORDER BY tmdb_id").bind(user.id),
  ]);
  const payload = {
    exported_at: new Date().toISOString(),
    source: "watchdeck.zalize.com",
    account: { email: user.email, display_name: user.display_name ?? null },
    tracked: tracked.results,
    episode_watches: episodes.results,
    movie_watches: movies.results,
  };
  return c.body(JSON.stringify(payload, null, 2), 200, {
    "content-type": "application/json; charset=utf-8",
    "content-disposition": `attachment; filename="watchdeck-export-${new Date().toISOString().slice(0, 10)}.json"`,
    "cache-control": "no-store",
  });
});

app.get("/api/export.csv", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const [tracked, episodes, movies] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT tmdb_id, media_type, title, status, rating FROM tracked WHERE user_id = ? ORDER BY title").bind(user.id),
    c.env.DB.prepare(
      `SELECT w.season, w.episode, w.watched_at, w.rating, t.title FROM episode_watches w
       LEFT JOIN tracked t ON t.user_id = w.user_id AND t.tmdb_id = w.tmdb_id AND t.media_type = 'tv'
       WHERE w.user_id = ? ORDER BY t.title, w.season, w.episode`
    ).bind(user.id),
    c.env.DB.prepare(
      `SELECT w.watched_at, t.title FROM movie_watches w
       LEFT JOIN tracked t ON t.user_id = w.user_id AND t.tmdb_id = w.tmdb_id AND t.media_type = 'movie'
       WHERE w.user_id = ? ORDER BY t.title`
    ).bind(user.id),
  ]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = ["type,title,season,episode,watched_at,rating,status"];
  for (const t of tracked.results as { media_type: string; title: string; status: string; rating: number | null }[]) {
    lines.push([t.media_type === "tv" ? "show" : "movie", esc(t.title), "", "", "", t.rating ?? "", t.status].join(","));
  }
  for (const e of episodes.results as { season: number; episode: number; watched_at: string; rating: number | null; title: string | null }[]) {
    lines.push(["episode", esc(e.title), e.season, e.episode, e.watched_at, e.rating ?? "", ""].join(","));
  }
  for (const m of movies.results as { watched_at: string; title: string | null }[]) {
    lines.push(["movie_watch", esc(m.title), "", "", m.watched_at, "", ""].join(","));
  }
  return c.body(lines.join("\n") + "\n", 200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="watchdeck-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    "cache-control": "no-store",
  });
});

app.post("/api/settings/services", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody({ all: true });
  const raw = form.service;
  const picked = (Array.isArray(raw) ? raw : raw != null ? [raw] : [])
    .map((v) => parseInt(String(v), 10))
    .filter((id) => SERVICE_IDS.has(id));
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM user_services WHERE user_id = ?").bind(user.id),
    ...picked.map((id) => c.env.DB.prepare("INSERT OR IGNORE INTO user_services (user_id, provider_id) VALUES (?, ?)").bind(user.id, id)),
  ]);
  return c.redirect("/settings?saved=" + encodeURIComponent(picked.length ? `Saved ${picked.length} service${picked.length === 1 ? "" : "s"}.` : "Services cleared."));
});

app.get("/roulette", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const pick =
    (await c.env.DB.prepare("SELECT tmdb_id, media_type, title FROM tracked WHERE user_id = ? AND status = 'watchlist' ORDER BY RANDOM() LIMIT 1")
      .bind(user.id)
      .first<{ tmdb_id: number; media_type: string; title: string }>()) ??
    (await c.env.DB.prepare("SELECT tmdb_id, media_type, title FROM tracked WHERE user_id = ? AND status = 'watching' ORDER BY RANDOM() LIMIT 1")
      .bind(user.id)
      .first<{ tmdb_id: number; media_type: string; title: string }>());
  if (!pick) return c.redirect("/library?status=watchlist");
  return c.redirect(`/${pick.media_type === "tv" ? "shows" : "movies"}/${pick.tmdb_id}-${slugify(pick.title)}`);
});

app.get("/lists", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const lists = await c.env.DB.prepare(
    `SELECT l.id, l.name, l.created_at,
       (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS item_count,
       (SELECT GROUP_CONCAT(poster_path) FROM (SELECT poster_path FROM list_items li WHERE li.list_id = l.id AND li.poster_path != '' ORDER BY li.added_at DESC LIMIT 4)) AS posters
     FROM lists l WHERE l.user_id = ? ORDER BY l.created_at DESC`
  )
    .bind(user.id)
    .all<ListRow>();
  return c.html(
    <Layout user={user} title="Your lists">
      <ListsPage lists={lists.results} error={c.req.query("error")} />
    </Layout>
  );
});

app.get("/lists/:id", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  const list = await c.env.DB.prepare("SELECT id, name, share_token FROM lists WHERE id = ? AND user_id = ?").bind(id, user.id).first<{ id: number; name: string; share_token: string | null }>();
  if (!list) return c.notFound();
  const items = await c.env.DB.prepare(
    "SELECT tmdb_id, media_type, title, poster_path FROM list_items WHERE list_id = ? ORDER BY added_at DESC"
  )
    .bind(id)
    .all<{ tmdb_id: number; media_type: string; title: string; poster_path: string | null }>();
  return c.html(
    <Layout user={user} title={list.name}>
      <ListDetailPage list={list} items={items.results} shareUrl={list.share_token ? `${c.env.SITE_URL}/list/${list.share_token}` : null} />
    </Layout>
  );
});

app.post("/api/lists/share", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const listId = parseInt(String(form.list_id), 10);
  if (!Number.isFinite(listId)) return c.redirect("/lists");
  const owned = await c.env.DB.prepare("SELECT id FROM lists WHERE id = ? AND user_id = ?").bind(listId, user.id).first();
  if (!owned) return c.redirect("/lists");
  if (form.enabled === "1") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    await c.env.DB.prepare("UPDATE lists SET share_token = ? WHERE id = ?").bind(token, listId).run();
  } else {
    await c.env.DB.prepare("UPDATE lists SET share_token = NULL WHERE id = ?").bind(listId).run();
  }
  return c.redirect(`/lists/${listId}`);
});

app.get("/list/:token", async (c) => {
  const token = c.req.param("token");
  if (!/^[0-9a-f]{32}$/.test(token)) return c.notFound();
  const list = await c.env.DB.prepare(
    "SELECT l.id, l.name, u.display_name, u.email FROM lists l JOIN users u ON u.id = l.user_id WHERE l.share_token = ?"
  )
    .bind(token)
    .first<{ id: number; name: string; display_name: string | null; email: string }>();
  if (!list) return c.notFound();
  const items = await c.env.DB.prepare(
    "SELECT tmdb_id, media_type, title, poster_path FROM list_items WHERE list_id = ? ORDER BY added_at DESC"
  )
    .bind(list.id)
    .all<{ tmdb_id: number; media_type: string; title: string; poster_path: string | null }>();
  const owner = list.display_name || list.email.split("@")[0];
  return c.html(
    <Layout
      user={c.get("user")}
      title={`${list.name} \u2014 a list by ${owner}`}
      description={`${items.results.length} shows & movies picked by ${owner} on WatchDeck.`}
      canonical={`${c.env.SITE_URL}/list/${token}`}
      ogImage={`${c.env.SITE_URL}/list/${token}/og.png`}
    >
      <PublicListPage name={list.name} owner={owner} items={items.results} />
    </Layout>
  );
});

app.get("/list/:token/og.png", async (c) => {
  const token = c.req.param("token");
  if (!/^[0-9a-f]{32}$/.test(token)) return c.notFound();
  const list = await c.env.DB.prepare(
    "SELECT l.id, l.name, u.display_name, u.email FROM lists l JOIN users u ON u.id = l.user_id WHERE l.share_token = ?"
  )
    .bind(token)
    .first<{ id: number; name: string; display_name: string | null; email: string }>();
  if (!list) return c.notFound();
  const items = await c.env.DB.prepare(
    "SELECT poster_path FROM list_items WHERE list_id = ? AND poster_path IS NOT NULL AND poster_path != '' ORDER BY added_at DESC LIMIT 5"
  )
    .bind(list.id)
    .all<{ poster_path: string }>();
  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM list_items WHERE list_id = ?").bind(list.id).first<{ n: number }>();
  const res = await listOgImage(
    c.env,
    list.name,
    list.display_name || list.email.split("@")[0],
    count?.n ?? 0,
    items.results.map((r) => r.poster_path)
  );
  res.headers.set("cache-control", "public, max-age=3600");
  return res;
});

app.post("/api/lists", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const name = String(form.name ?? "").trim().slice(0, 60);
  if (!name) return c.redirect("/lists");
  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM lists WHERE user_id = ?").bind(user.id).first<{ n: number }>();
  if ((count?.n ?? 0) >= 50) return c.redirect("/lists?error=" + encodeURIComponent("You've reached the 50-list limit."));
  await c.env.DB.prepare("INSERT INTO lists (user_id, name) VALUES (?, ?)").bind(user.id, name).run();
  return c.redirect("/lists");
});

app.post("/api/lists/delete", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const listId = parseInt(String(form.list_id), 10);
  if (Number.isFinite(listId)) {
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM list_items WHERE list_id = (SELECT id FROM lists WHERE id = ? AND user_id = ?)").bind(listId, user.id),
      c.env.DB.prepare("DELETE FROM lists WHERE id = ? AND user_id = ?").bind(listId, user.id),
    ]);
  }
  return c.redirect("/lists");
});

app.post("/api/lists/add", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const listId = parseInt(String(form.list_id), 10);
  const tmdbId = parseInt(String(form.tmdb_id), 10);
  const mediaType = String(form.media_type);
  const title = String(form.title ?? "").trim().slice(0, 200);
  const posterPath = String(form.poster_path ?? "").slice(0, 100);
  const back = safeNext(form.redirect) ?? "/lists";
  if (!Number.isFinite(listId) || !tmdbId || !title || (mediaType !== "tv" && mediaType !== "movie")) return c.redirect(back);
  const owned = await c.env.DB.prepare("SELECT id FROM lists WHERE id = ? AND user_id = ?").bind(listId, user.id).first();
  if (!owned) return c.redirect(back);
  const size = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM list_items WHERE list_id = ?").bind(listId).first<{ n: number }>();
  if ((size?.n ?? 0) >= 500) return c.redirect(back);
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO list_items (list_id, tmdb_id, media_type, title, poster_path) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(listId, tmdbId, mediaType, title, posterPath || null)
    .run();
  return c.redirect(back);
});

app.post("/api/lists/remove", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const listId = parseInt(String(form.list_id), 10);
  const tmdbId = parseInt(String(form.tmdb_id), 10);
  const mediaType = String(form.media_type);
  const back = safeNext(form.redirect) ?? "/lists";
  if (Number.isFinite(listId) && tmdbId) {
    await c.env.DB.prepare(
      "DELETE FROM list_items WHERE list_id = (SELECT id FROM lists WHERE id = ? AND user_id = ?) AND tmdb_id = ? AND media_type = ?"
    )
      .bind(listId, user.id, tmdbId, mediaType)
      .run();
  }
  return c.redirect(back);
});

app.post("/api/settings/profile", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const name = String(form.display_name ?? "").trim().slice(0, 40);
  await c.env.DB.prepare("UPDATE users SET display_name = ? WHERE id = ?").bind(name || null, user.id).run();
  return c.redirect("/settings?saved=" + encodeURIComponent("Profile updated."));
});

app.post("/api/settings/password", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const current = String(form.current ?? "");
  const next = String(form.next ?? "");
  if (next.length < 8) return c.redirect("/settings?error=" + encodeURIComponent("New password must be at least 8 characters."));
  const row = await c.env.DB.prepare("SELECT password_hash, salt FROM users WHERE id = ?")
    .bind(user.id)
    .first<{ password_hash: string; salt: string }>();
  if (!row || !(await verifyPassword(current, row.salt, row.password_hash))) {
    return c.redirect("/settings?error=" + encodeURIComponent("Current password is incorrect."));
  }
  const { hash, salt } = await hashPassword(next);
  await c.env.DB.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?").bind(hash, salt, user.id).run();
  return c.redirect("/settings?saved=" + encodeURIComponent("Password updated."));
});

app.post("/api/settings/delete", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const password = String(form.password ?? "");
  const row = await c.env.DB.prepare("SELECT password_hash, salt FROM users WHERE id = ?")
    .bind(user.id)
    .first<{ password_hash: string; salt: string }>();
  if (!row || !(await verifyPassword(password, row.salt, row.password_hash))) {
    return c.redirect("/settings?error=" + encodeURIComponent("Password is incorrect \u2014 account not deleted."));
  }
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM episode_watches WHERE user_id = ?").bind(user.id),
    c.env.DB.prepare("DELETE FROM movie_watches WHERE user_id = ?").bind(user.id),
    c.env.DB.prepare("DELETE FROM tracked WHERE user_id = ?").bind(user.id),
    c.env.DB.prepare("DELETE FROM share_tokens WHERE user_id = ?").bind(user.id),
    c.env.DB.prepare("DELETE FROM wrapped_shares WHERE user_id = ?").bind(user.id),
    c.env.DB.prepare("DELETE FROM feed_tokens WHERE user_id = ?").bind(user.id),
    c.env.DB.prepare("DELETE FROM password_resets WHERE user_id = ?").bind(user.id),
    c.env.DB.prepare("DELETE FROM imports WHERE user_id = ?").bind(user.id),
    c.env.DB.prepare("DELETE FROM user_services WHERE user_id = ?").bind(user.id),
    c.env.DB.prepare("DELETE FROM list_items WHERE list_id IN (SELECT id FROM lists WHERE user_id = ?)").bind(user.id),
    c.env.DB.prepare("DELETE FROM lists WHERE user_id = ?").bind(user.id),
    c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
    c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id),
  ]);
  await destroySession(c);
  return c.redirect("/");
});

app.get("/stats", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const [stats, share] = await Promise.all([
    userStats(c.env, user.id),
    c.env.DB.prepare("SELECT token FROM share_tokens WHERE user_id = ?").bind(user.id).first<{ token: string }>(),
  ]);
  return c.html(
    <Layout user={user} title="Stats">
      <StatsPage stats={stats} shareUrl={share ? `${c.env.SITE_URL}/u/${share.token}` : null} />
    </Layout>
  );
});

app.post("/api/share", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  if (form.enabled === "1") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    await c.env.DB.prepare("INSERT OR IGNORE INTO share_tokens (token, user_id) VALUES (?, ?)").bind(token, user.id).run();
  } else {
    await c.env.DB.prepare("DELETE FROM share_tokens WHERE user_id = ?").bind(user.id).run();
  }
  return c.redirect("/stats");
});

async function shareProfile(env: Env, token: string): Promise<{ name: string; stats: UserStats; lists: { name: string; share_token: string; item_count: number }[] } | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const row = await env.DB.prepare(
    "SELECT u.id, u.display_name, u.email FROM share_tokens s JOIN users u ON u.id = s.user_id WHERE s.token = ?"
  ).bind(token).first<{ id: number; display_name: string | null; email: string }>();
  if (!row) return null;
  const [stats, lists] = await Promise.all([
    userStats(env, row.id),
    env.DB.prepare(
      "SELECT name, share_token, (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS item_count FROM lists l WHERE user_id = ? AND share_token IS NOT NULL ORDER BY created_at DESC"
    )
      .bind(row.id)
      .all<{ name: string; share_token: string; item_count: number }>(),
  ]);
  return { name: row.display_name || row.email.split("@")[0], stats, lists: lists.results };
}

app.get("/u/:token", async (c) => {
  const token = c.req.param("token");
  const profile = await shareProfile(c.env, token);
  if (!profile) return c.notFound();
  return c.html(
    <Layout
      user={c.get("user")}
      title={`${profile.name}'s watch stats`}
      description={`${profile.stats.hoursWatched} hours of TV & movies \u2014 ${profile.stats.epsWatched} episodes and ${profile.stats.moviesWatched} movies tracked on WatchDeck.`}
      canonical={`${c.env.SITE_URL}/u/${token}`}
      ogImage={`${c.env.SITE_URL}/u/${token}/og.png`}
    >
      <PublicProfilePage stats={profile.stats} name={profile.name} lists={profile.lists} />
    </Layout>
  );
});

app.get("/u/:token/og.png", async (c) => {
  const token = c.req.param("token");
  const profile = await shareProfile(c.env, token);
  if (!profile) return c.notFound();
  const res = await shareOgImage(c.env, profile.name, profile.stats);
  res.headers.set("cache-control", "public, max-age=3600");
  return res;
});

app.get("/import", (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/signup");
  return c.html(
    <Layout user={user} title="Import from TV Time">
      <ImportPage welcome={c.req.query("welcome") === "1"} />
    </Layout>
  );
});

// ---------- api ----------
app.post("/api/waitlist", async (c) => {
  if (!(await rateLimit(c, "waitlist", 5))) return c.redirect("/?subscribed=1");
  const form = await c.req.parseBody();
  const email = String(form.email ?? "").trim().toLowerCase();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    const token = crypto.randomUUID();
    const res = await c.env.DB.prepare("INSERT OR IGNORE INTO email_signups (email, source, confirm_token) VALUES (?, 'landing', ?)")
      .bind(email, token)
      .run();
    if (res.meta.changes > 0) {
      c.executionCtx.waitUntil(sendEmail(c.env, email, ...confirmSignupEmail(c.env.SITE_URL, token)));
    }
  }
  return c.redirect("/?subscribed=1");
});

app.get("/confirm-email/:token", async (c) => {
  const token = c.req.param("token");
  const row = await c.env.DB.prepare("SELECT confirmed FROM email_signups WHERE confirm_token = ?").bind(token).first<{ confirmed: number }>();
  if (row && !row.confirmed) {
    await c.env.DB.prepare("UPDATE email_signups SET confirmed = 1 WHERE confirm_token = ?").bind(token).run();
  }
  const heading = !row ? "Link not recognized" : row.confirmed ? "Already confirmed \u2713" : "You're subscribed \u2713";
  const body = !row
    ? "This confirmation link is invalid."
    : row.confirmed
      ? "This subscription was already confirmed \u2014 you're all set. You can unsubscribe from any email we send."
      : "Thanks for confirming \u2014 we'll send occasional product updates. You can unsubscribe from any email we send.";
  return c.html(
    <Layout user={c.get("user")} title="Subscription confirmed">
      <div class="mx-auto max-w-md py-16 text-center">
        <h1 class="text-2xl font-bold">{heading}</h1>
        <p class="mt-3 text-slate-400">{body}</p>
        <a href="/" class="mt-6 inline-block rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-500">Back to WatchDeck</a>
      </div>
    </Layout>
  );
});

async function unsubscribeByToken(env: Env, token: string): Promise<boolean> {
  const res = await env.DB.prepare("UPDATE users SET remind_email = 0 WHERE unsub_token = ?").bind(token).run();
  return res.meta.changes > 0;
}

app.get("/unsubscribe/:token", async (c) => {
  const ok = await unsubscribeByToken(c.env, c.req.param("token"));
  return c.html(
    <Layout user={c.get("user")} title="Unsubscribed">
      <div class="mx-auto max-w-md py-16 text-center">
        <h1 class="text-2xl font-bold">{ok ? "You're unsubscribed" : "Link not recognized"}</h1>
        <p class="mt-3 text-slate-400">
          {ok
            ? "Email airing reminders are now off. You can turn them back on any time from your calendar page."
            : "This unsubscribe link is invalid \u2014 you may already be unsubscribed."}
        </p>
        <a href="/calendar" class="mt-6 inline-block rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-500">Calendar settings</a>
      </div>
    </Layout>
  );
});

// RFC 8058 one-click unsubscribe (mailbox providers POST here)
app.post("/unsubscribe/:token", async (c) => {
  await unsubscribeByToken(c.env, c.req.param("token"));
  return c.text("OK");
});

app.post("/api/rate", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const tmdbId = parseInt(String(form.tmdb_id), 10);
  const mediaType = String(form.media_type) === "movie" ? "movie" : "tv";
  const rating = parseInt(String(form.rating), 10);
  const title = String(form.title ?? "").slice(0, 300);
  const posterPath = String(form.poster_path ?? "") || null;
  if (!Number.isFinite(tmdbId) || !Number.isFinite(rating) || rating < 0 || rating > 5 || !title) return c.json({ error: "bad request" }, 400);
  await c.env.DB.prepare(
    `INSERT INTO tracked (user_id, tmdb_id, media_type, title, poster_path, status, rating)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, tmdb_id, media_type) DO UPDATE SET rating = excluded.rating, updated_at = datetime('now')`
  )
    .bind(user.id, tmdbId, mediaType, title, posterPath, mediaType === "movie" ? "completed" : "watching", rating === 0 ? null : rating)
    .run();
  return c.redirect(safeNext(form.redirect) ?? "/library");
});

app.post("/api/notes", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const tmdbId = parseInt(String(form.tmdb_id), 10);
  const mediaType = String(form.media_type) === "movie" ? "movie" : "tv";
  const notes = String(form.notes ?? "").trim().slice(0, 2000);
  if (!Number.isFinite(tmdbId)) return c.json({ error: "bad request" }, 400);
  await c.env.DB.prepare(
    "UPDATE tracked SET notes = ?, updated_at = datetime('now') WHERE user_id = ? AND tmdb_id = ? AND media_type = ?"
  )
    .bind(notes || null, user.id, tmdbId, mediaType)
    .run();
  return c.redirect(safeNext(form.redirect) ?? "/library");
});

app.post("/api/track", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const tmdbId = parseInt(String(form.tmdb_id), 10);
  const mediaType = String(form.media_type) === "movie" ? "movie" : "tv";
  const status = ["watching", "watchlist", "completed", "dropped"].includes(String(form.status))
    ? String(form.status)
    : "watching";
  const details = mediaType === "tv" ? await tvDetails(c.env, tmdbId) : await movieDetails(c.env, tmdbId);
  const title = "name" in details ? details.name : details.title;
  await c.env.DB.prepare(
    `INSERT INTO tracked (user_id, tmdb_id, media_type, title, poster_path, status)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, tmdb_id, media_type) DO UPDATE SET status = excluded.status, updated_at = datetime('now')`
  )
    .bind(user.id, tmdbId, mediaType, title, details.poster_path, status)
    .run();
  return c.redirect(safeNext(form.redirect) ?? "/home");
});

app.post("/api/untrack", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const tmdbId = parseInt(String(form.tmdb_id), 10);
  const mediaType = String(form.media_type) === "movie" ? "movie" : "tv";
  await c.env.DB.prepare("DELETE FROM tracked WHERE user_id = ? AND tmdb_id = ? AND media_type = ?")
    .bind(user.id, tmdbId, mediaType)
    .run();
  return c.redirect(safeNext(form.redirect) ?? "/library");
});

app.post("/api/watch", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const tmdbId = parseInt(String(form.tmdb_id), 10);
  const season = parseInt(String(form.season), 10);
  const episode = parseInt(String(form.episode), 10);
  if (String(form.undo) === "1") {
    await c.env.DB.prepare("DELETE FROM episode_watches WHERE user_id = ? AND tmdb_id = ? AND season = ? AND episode = ?")
      .bind(user.id, tmdbId, season, episode)
      .run();
    await c.env.DB.prepare("UPDATE tracked SET status = 'watching' WHERE user_id = ? AND tmdb_id = ? AND media_type = 'tv' AND status = 'completed'")
      .bind(user.id, tmdbId)
      .run();
  } else {
    await c.env.DB.prepare("INSERT OR IGNORE INTO episode_watches (user_id, tmdb_id, season, episode) VALUES (?, ?, ?, ?)")
      .bind(user.id, tmdbId, season, episode)
      .run();
    const details = await tvDetails(c.env, tmdbId);
    await c.env.DB.prepare(
      `INSERT INTO tracked (user_id, tmdb_id, media_type, title, poster_path, status)
       VALUES (?, ?, 'tv', ?, ?, 'watching')
       ON CONFLICT(user_id, tmdb_id, media_type) DO UPDATE SET updated_at = datetime('now')`
    )
      .bind(user.id, tmdbId, details.name, details.poster_path)
      .run();
    await maybeAutoComplete(c.env, user.id, tmdbId, details);
  }
  invalidateHours(c, user.id);
  return c.redirect(safeNext(form.redirect) ?? "/home");
});

app.post("/api/watch-again", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const tmdbId = parseInt(String(form.tmdb_id), 10);
  const season = parseInt(String(form.season), 10);
  const episode = parseInt(String(form.episode), 10);
  await c.env.DB.prepare(
    "UPDATE episode_watches SET plays = plays + 1, watched_at = datetime('now') WHERE user_id = ? AND tmdb_id = ? AND season = ? AND episode = ?"
  )
    .bind(user.id, tmdbId, season, episode)
    .run();
  invalidateHours(c, user.id);
  return c.redirect(safeNext(form.redirect) ?? "/home");
});

app.post("/api/episode-rating", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const tmdbId = parseInt(String(form.tmdb_id), 10);
  const season = parseInt(String(form.season), 10);
  const episode = parseInt(String(form.episode), 10);
  const raw = parseInt(String(form.rating), 10);
  const rating = Number.isFinite(raw) && raw >= 1 && raw <= 5 ? raw : null;
  await c.env.DB.prepare("UPDATE episode_watches SET rating = ? WHERE user_id = ? AND tmdb_id = ? AND season = ? AND episode = ?")
    .bind(rating, user.id, tmdbId, season, episode)
    .run();
  return c.redirect(safeNext(form.redirect) ?? "/home");
});

app.post("/api/reminders", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const enabled = String(form.enabled) === "1" ? 1 : 0;
  await c.env.DB.prepare("UPDATE users SET remind_email = ? WHERE id = ?").bind(enabled, user.id).run();
  return c.redirect("/calendar");
});

app.post("/api/watch-season", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const tmdbId = parseInt(String(form.tmdb_id), 10);
  const seasonNum = parseInt(String(form.season), 10);
  if (String(form.undo) === "1") {
    await c.env.DB.prepare("DELETE FROM episode_watches WHERE user_id = ? AND tmdb_id = ? AND season = ?")
      .bind(user.id, tmdbId, seasonNum)
      .run();
    await c.env.DB.prepare("UPDATE tracked SET status = 'watching' WHERE user_id = ? AND tmdb_id = ? AND media_type = 'tv' AND status = 'completed'")
      .bind(user.id, tmdbId)
      .run();
    invalidateHours(c, user.id);
    return c.redirect(safeNext(form.redirect) ?? "/home");
  }
  const details = await tvDetails(c.env, tmdbId);
  const season = await seasonDetails(c.env, tmdbId, seasonNum);
  const today = new Date().toISOString().slice(0, 10);
  const aired = season.episodes.filter((ep) => ep.air_date && ep.air_date <= today);
  const stmts = aired.map((ep) =>
    c.env.DB.prepare("INSERT OR IGNORE INTO episode_watches (user_id, tmdb_id, season, episode) VALUES (?, ?, ?, ?)").bind(
      user.id,
      tmdbId,
      ep.season_number,
      ep.episode_number
    )
  );
  for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50));
  await c.env.DB.prepare(
    `INSERT INTO tracked (user_id, tmdb_id, media_type, title, poster_path, status)
     VALUES (?, ?, 'tv', ?, ?, 'watching')
     ON CONFLICT(user_id, tmdb_id, media_type) DO UPDATE SET updated_at = datetime('now')`
  )
    .bind(user.id, tmdbId, details.name, details.poster_path)
    .run();
  await maybeAutoComplete(c.env, user.id, tmdbId, details);
  invalidateHours(c, user.id);
  return c.redirect(safeNext(form.redirect) ?? "/home");
});

app.post("/api/watch-up-to", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const tmdbId = parseInt(String(form.tmdb_id), 10);
  const targetSeason = parseInt(String(form.season), 10);
  const targetEpisode = parseInt(String(form.episode), 10);
  if (!Number.isFinite(tmdbId) || !Number.isFinite(targetSeason) || !Number.isFinite(targetEpisode)) {
    return c.redirect(safeNext(form.redirect) ?? "/home");
  }
  const details = await tvDetails(c.env, tmdbId);
  const today = new Date().toISOString().slice(0, 10);
  const seasonNums = details.seasons
    .filter((s) => s.season_number > 0 && s.season_number <= targetSeason)
    .map((s) => s.season_number);
  const seasons = await Promise.all(seasonNums.map((n) => seasonDetails(c.env, tmdbId, n)));
  const stmts = seasons
    .flatMap((s) => s.episodes)
    .filter(
      (ep) =>
        ep.air_date &&
        ep.air_date <= today &&
        (ep.season_number < targetSeason || (ep.season_number === targetSeason && ep.episode_number <= targetEpisode))
    )
    .map((ep) =>
      c.env.DB.prepare("INSERT OR IGNORE INTO episode_watches (user_id, tmdb_id, season, episode) VALUES (?, ?, ?, ?)").bind(
        user.id,
        tmdbId,
        ep.season_number,
        ep.episode_number
      )
    );
  for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50));
  await c.env.DB.prepare(
    `INSERT INTO tracked (user_id, tmdb_id, media_type, title, poster_path, status)
     VALUES (?, ?, 'tv', ?, ?, 'watching')
     ON CONFLICT(user_id, tmdb_id, media_type) DO UPDATE SET updated_at = datetime('now')`
  )
    .bind(user.id, tmdbId, details.name, details.poster_path)
    .run();
  await maybeAutoComplete(c.env, user.id, tmdbId, details);
  invalidateHours(c, user.id);
  return c.redirect(safeNext(form.redirect) ?? "/home");
});

app.post("/api/watch-movie", async (c) => {
  const user = c.get("user");
  if (!user) return loginRedirect(c);
  const form = await c.req.parseBody();
  const tmdbId = parseInt(String(form.tmdb_id), 10);
  if (String(form.undo) === "1") {
    await c.env.DB.prepare(
      "DELETE FROM movie_watches WHERE id = (SELECT id FROM movie_watches WHERE user_id = ? AND tmdb_id = ? ORDER BY watched_at DESC, id DESC LIMIT 1)"
    )
      .bind(user.id, tmdbId)
      .run();
    const remaining = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM movie_watches WHERE user_id = ? AND tmdb_id = ?")
      .bind(user.id, tmdbId)
      .first<{ n: number }>();
    if ((remaining?.n ?? 0) === 0) {
      await c.env.DB.prepare(
        "UPDATE tracked SET status = 'watchlist', updated_at = datetime('now') WHERE user_id = ? AND tmdb_id = ? AND media_type = 'movie' AND status = 'completed'"
      )
        .bind(user.id, tmdbId)
        .run();
    }
  } else {
    if (String(form.rewatch) === "1") {
      await c.env.DB.prepare("INSERT INTO movie_watches (user_id, tmdb_id) VALUES (?, ?)").bind(user.id, tmdbId).run();
    } else {
      await c.env.DB.prepare(
        "INSERT INTO movie_watches (user_id, tmdb_id) SELECT ?1, ?2 WHERE NOT EXISTS (SELECT 1 FROM movie_watches WHERE user_id = ?1 AND tmdb_id = ?2)"
      )
        .bind(user.id, tmdbId)
        .run();
    }
    const details = await movieDetails(c.env, tmdbId);
    await c.env.DB.prepare(
      `INSERT INTO tracked (user_id, tmdb_id, media_type, title, poster_path, status)
       VALUES (?, ?, 'movie', ?, ?, 'completed')
       ON CONFLICT(user_id, tmdb_id, media_type) DO UPDATE SET status = 'completed', updated_at = datetime('now')`
    )
      .bind(user.id, tmdbId, details.title, details.poster_path)
      .run();
  }
  invalidateHours(c, user.id);
  return c.redirect(safeNext(form.redirect) ?? "/home");
});

// step 1: parse the uploaded export (TV Time ZIP, or a Trakt/Serializd-style CSV) into JSON (no TMDB calls here)
app.post("/api/import/parse", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "auth" }, 401);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.length > 30 * 1024 * 1024) return c.json({ error: "File too large (max 30 MB)" }, 413);
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  try {
    const text = isZip ? "" : new TextDecoder().decode(bytes);
    const source = isZip ? "tvtime" : isNetflixCsv(text) ? "netflix" : "csv";
    const parsed = isZip ? parseTvTimeZip(bytes) : source === "netflix" ? parseNetflixCsv(text) : parseGenericCsv(text);
    if (parsed.shows.length === 0 && parsed.movies.length === 0) {
      logFunnel(c, "import-parse-empty");
      return c.json(
        { error: isZip ? "No TV Time data found in this ZIP. Make sure it's the GDPR export." : "No shows or movies found in this CSV \u2014 it needs a title column." },
        422
      );
    }
    logFunnel(c, "import-parse-ok");
    return c.json({ ...parsed, source });
  } catch {
    logFunnel(c, "import-parse-fail");
    return c.json({ error: isZip ? "Could not read that ZIP file." : "Could not read that file. Upload a TV Time ZIP or a CSV export." }, 422);
  }
});

// step 2: client sends batches (<=20 titles) — we match via TMDB and insert
app.post("/api/import/batch", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "auth" }, 401);
  const batch = (await c.req.json()) as ParsedImport & { source?: string };
  const source = batch.source === "netflix" || batch.source === "csv" ? batch.source : "tvtime";
  let showsImported = 0;
  let episodesImported = 0;
  let moviesImported = 0;
  const unmatchedNames: string[] = [];

  for (const show of (batch.shows ?? []).slice(0, 20)) {
    try {
      const res = await searchTv(c.env, show.name);
      const match = res.results[0];
      if (!match) {
        unmatchedNames.push(show.name);
        continue;
      }
      const title = match.name ?? show.name;
      const allWatched = show.episodes.length > 0;
      const showRating = Number.isInteger(show.rating) && show.rating! >= 1 && show.rating! <= 5 ? show.rating! : null;
      await c.env.DB.prepare(
        `INSERT INTO tracked (user_id, tmdb_id, media_type, title, poster_path, status, source, rating)
         VALUES (?, ?, 'tv', ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, tmdb_id, media_type) DO UPDATE SET rating = COALESCE(tracked.rating, excluded.rating)`
      )
        .bind(user.id, match.id, title, match.poster_path, allWatched ? "watching" : "watchlist", source, showRating)
        .run();
      showsImported++;
      const stmts = show.episodes.slice(0, 400).map((e) =>
        c.env.DB.prepare(
          "INSERT OR IGNORE INTO episode_watches (user_id, tmdb_id, season, episode, watched_at) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))"
        ).bind(user.id, match.id, e.season, e.episode, e.watchedAt)
      );
      for (let i = 0; i < stmts.length; i += 50) {
        await c.env.DB.batch(stmts.slice(i, i + 50));
      }
      episodesImported += stmts.length;
    } catch {
      unmatchedNames.push(show.name);
    }
  }

  for (const movie of (batch.movies ?? []).slice(0, 20)) {
    try {
      const res = await searchMovie(c.env, movie.name);
      const match = res.results[0];
      if (!match) {
        unmatchedNames.push(movie.name);
        continue;
      }
      const movieRating = Number.isInteger(movie.rating) && movie.rating! >= 1 && movie.rating! <= 5 ? movie.rating! : null;
      await c.env.DB.batch([
        c.env.DB.prepare(
          `INSERT INTO tracked (user_id, tmdb_id, media_type, title, poster_path, status, source, rating)
           VALUES (?, ?, 'movie', ?, ?, 'completed', ?, ?)
           ON CONFLICT(user_id, tmdb_id, media_type) DO UPDATE SET rating = COALESCE(tracked.rating, excluded.rating)`
        ).bind(user.id, match.id, match.title ?? movie.name, match.poster_path, source, movieRating),
        c.env.DB.prepare(
          "INSERT INTO movie_watches (user_id, tmdb_id, watched_at) SELECT ?1, ?2, COALESCE(?3, datetime('now')) WHERE NOT EXISTS (SELECT 1 FROM movie_watches WHERE user_id = ?1 AND tmdb_id = ?2)"
        ).bind(user.id, match.id, movie.watchedAt),
      ]);
      moviesImported++;
    } catch {
      unmatchedNames.push(movie.name);
    }
  }

  await c.env.DB.prepare(
    "INSERT INTO imports (user_id, source, shows_imported, episodes_imported, movies_imported, unmatched) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(user.id, source, showsImported, episodesImported, moviesImported, unmatchedNames.length)
    .run();

  invalidateHours(c, user.id);
  logFunnel(c, "import-batch-done");
  return c.json({ showsImported, episodesImported, moviesImported, unmatched: unmatchedNames.length, unmatchedNames });
});

// ---------- seo ----------
app.get("/robots.txt", (c) =>
  c.text(
    `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /home\nDisallow: /library\nDisallow: /lists\nDisallow: /roulette\nDisallow: /calendar\nDisallow: /import\nDisallow: /stats\nDisallow: /history\nDisallow: /settings\nDisallow: /forgot\nDisallow: /reset\nDisallow: /unsubscribe/\nDisallow: /confirm-email/\nDisallow: /u/\nDisallow: /wrapped\nDisallow: /more\nDisallow: /search?*\n\nSitemap: ${c.env.SITE_URL}/sitemap.xml\n`
  )
);

app.get("/sitemap.xml", async (c) => {
  const urls: string[] = [`${c.env.SITE_URL}/`, `${c.env.SITE_URL}/search`, `${c.env.SITE_URL}/browse`, `${c.env.SITE_URL}/signup`, `${c.env.SITE_URL}/login`, `${c.env.SITE_URL}/pricing`, `${c.env.SITE_URL}/about`, `${c.env.SITE_URL}/guides`, ...GUIDES.map((g) => `${c.env.SITE_URL}/guides/${g.slug}`), `${c.env.SITE_URL}/privacy`, `${c.env.SITE_URL}/terms`];
  try {
    const [shows, movies, tvGenres, movieGenres, people1, people2, people3, ...popular] = await Promise.all([
      trendingTv(c.env),
      trendingMovies(c.env),
      genreList(c.env, "tv"),
      genreList(c.env, "movie"),
      popularPeople(c.env, 1),
      popularPeople(c.env, 2),
      popularPeople(c.env, 3),
      discoverPopular(c.env, "tv", 1),
      discoverPopular(c.env, "tv", 2),
      discoverPopular(c.env, "tv", 3),
      discoverPopular(c.env, "tv", 4),
      discoverPopular(c.env, "movie", 1),
      discoverPopular(c.env, "movie", 2),
      discoverPopular(c.env, "movie", 3),
      discoverPopular(c.env, "movie", 4),
      topRated(c.env, "tv", 1),
      topRated(c.env, "tv", 2),
      topRated(c.env, "tv", 3),
      topRated(c.env, "tv", 4),
      topRated(c.env, "movie", 1),
      topRated(c.env, "movie", 2),
      topRated(c.env, "movie", 3),
      topRated(c.env, "movie", 4),
    ]);
    const seen = new Set<string>();
    const pushTitle = (type: "tv" | "movie", id: number, title: string) => {
      const key = `${type}:${id}`;
      if (seen.has(key)) return;
      seen.add(key);
      urls.push(`${c.env.SITE_URL}/${type === "tv" ? "shows" : "movies"}/${id}-${slugify(title)}`);
    };
    for (const s of shows.results) pushTitle("tv", s.id, s.name ?? "");
    for (const m of movies.results) pushTitle("movie", m.id, m.title ?? "");
    for (const [i, p] of popular.entries()) {
      const type = i < 4 || (i >= 8 && i < 12) ? "tv" : "movie";
      for (const r of p.results) pushTitle(type, r.id, (type === "tv" ? r.name : r.title) ?? "");
    }
    for (const p of [...people1.results, ...people2.results, ...people3.results]) {
      if (p.profile_path) urls.push(`${c.env.SITE_URL}/person/${p.id}-${slugify(p.name)}`);
    }
    for (const g of tvGenres.genres) urls.push(`${c.env.SITE_URL}/browse/tv/${g.id}-${slugify(g.name)}`);
    for (const g of movieGenres.genres) urls.push(`${c.env.SITE_URL}/browse/movie/${g.id}-${slugify(g.name)}`);
    for (const n of NETWORKS) urls.push(`${c.env.SITE_URL}/browse/network/${n.id}-${slugify(n.name)}`);
    urls.push(`${c.env.SITE_URL}/browse/top-rated/tv`, `${c.env.SITE_URL}/browse/top-rated/movie`);
    urls.push(`${c.env.SITE_URL}/browse/trending/tv`, `${c.env.SITE_URL}/browse/trending/movie`);
    urls.push(`${c.env.SITE_URL}/browse/on-the-air/tv`, `${c.env.SITE_URL}/browse/coming-soon/movie`);
    for (const y of browseYears()) {
      urls.push(`${c.env.SITE_URL}/browse/year/tv/${y}`, `${c.env.SITE_URL}/browse/year/movie/${y}`);
    }
  } catch {}
  const lastmod = new Map(GUIDES.map((g) => [`${c.env.SITE_URL}/guides/${g.slug}`, new Date(g.updated).toISOString().slice(0, 10)]));
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u}</loc>${lastmod.has(u) ? `<lastmod>${lastmod.get(u)}</lastmod>` : ""}</url>`)
    .join("\n")}\n</urlset>`;
  return c.body(body, 200, { "content-type": "application/xml" });
});

app.get("/:key{[a-f0-9]{32}\\.txt}", (c) => {
  const key = c.req.param("key").replace(/\.txt$/, "");
  if (c.env.INDEXNOW_KEY && key === c.env.INDEXNOW_KEY) return c.text(key);
  return c.notFound();
});

app.post("/api/indexnow", async (c) => {
  const user = c.get("user");
  if (!user || (c.env.ADMIN_EMAIL && user.email !== c.env.ADMIN_EMAIL.toLowerCase())) return c.json({ error: "forbidden" }, 403);
  if (!c.env.INDEXNOW_KEY) return c.json({ error: "no key configured" }, 400);
  const form = await c.req.parseBody();
  const paths = String(form.paths ?? "")
    .split(/\s+/)
    .map((p) => p.trim())
    .filter((p) => p.startsWith("/"));
  if (paths.length === 0 || paths.length > 100) return c.json({ error: "provide 1-100 paths" }, 400);
  const host = new URL(c.env.SITE_URL).host;
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key: c.env.INDEXNOW_KEY,
      keyLocation: `${c.env.SITE_URL}/${c.env.INDEXNOW_KEY}.txt`,
      urlList: paths.map((p) => `${c.env.SITE_URL}${p}`),
    }),
  });
  return c.json({ submitted: paths.length, status: res.status });
});

app.post("/api/admin/cron", async (c) => {
  const user = c.get("user");
  if (!user || (c.env.ADMIN_EMAIL && user.email !== c.env.ADMIN_EMAIL.toLowerCase())) return c.json({ error: "forbidden" }, 403);
  const form = await c.req.parseBody();
  const job = String(form.job ?? "");
  if (job === "prune") {
    await pruneAnalytics(c.env);
    return c.json({ ok: true, job });
  }
  if (job === "digest") {
    await sendAiringDigests(c.env);
    return c.json({ ok: true, job });
  }
  if (job === "indexnow") {
    await submitSitemapToIndexNow(c.env);
    return c.json({ ok: true, job });
  }
  return c.json({ error: "job must be prune, digest or indexnow" }, 400);
});

app.get("/api/stats", async (c) => {
  const user = c.get("user");
  if (!user || (c.env.ADMIN_EMAIL && user.email !== c.env.ADMIN_EMAIL.toLowerCase())) return c.json({ error: "forbidden" }, 403);
  const [daily, countries, topPaths, searches, signups, waitlist, funnel] = await Promise.all([
    c.env.DB.prepare(
      "SELECT date(ts) AS day, COUNT(*) AS views FROM analytics_events WHERE ua_class NOT IN ('bot','funnel') GROUP BY day ORDER BY day DESC LIMIT 30"
    ).all(),
    c.env.DB.prepare(
      "SELECT country, COUNT(*) AS views FROM analytics_events WHERE ua_class NOT IN ('bot','funnel') AND ts >= datetime('now', '-30 days') GROUP BY country ORDER BY views DESC LIMIT 15"
    ).all(),
    c.env.DB.prepare(
      "SELECT path, COUNT(*) AS views FROM analytics_events WHERE ua_class NOT IN ('bot','funnel') AND ts >= datetime('now', '-30 days') GROUP BY path ORDER BY views DESC LIMIT 20"
    ).all(),
    c.env.DB.prepare(
      "SELECT q, COUNT(*) AS n, MAX(results) AS results FROM search_queries WHERE ts >= datetime('now', '-30 days') GROUP BY q ORDER BY n DESC LIMIT 20"
    ).all(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM email_signups").first<{ n: number }>(),
    c.env.DB.prepare(
      "SELECT path, COUNT(*) AS n FROM analytics_events WHERE ua_class = 'funnel' AND ts >= datetime('now', '-30 days') GROUP BY path ORDER BY n DESC"
    ).all(),
  ]);
  return c.json({
    daily: daily.results,
    countries: countries.results,
    topPaths: topPaths.results,
    topSearches: searches.results,
    users: signups?.n ?? 0,
    waitlist: waitlist?.n ?? 0,
    funnel: funnel.results,
  });
});

app.notFound((c) =>
  c.html(
    <Layout user={c.get("user")} title="Not found">
      <div class="mx-auto max-w-md py-20 text-center">
        <h1 class="text-3xl font-bold">404</h1>
        <p class="mt-2 text-slate-400">That page drifted off the deck.</p>
        <form action="/search" method="get" class="mt-6 flex gap-2">
          <input
            type="search"
            name="q"
            placeholder="Search shows & movies…"
            aria-label="Search shows and movies"
            class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm placeholder-slate-500 focus:border-violet-500 focus:outline-none"
          />
          <button class="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">Search</button>
        </form>
        <p class="mt-4 text-sm text-slate-400">
          Or <a href="/browse" class="text-violet-400 hover:underline">browse by genre</a> · <a href="/" class="text-violet-400 hover:underline">go home</a>.
        </p>
      </div>
    </Layout>,
    404
  )
);

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.html(
    <Layout user={c.get("user")} title="Something went wrong">
      <div class="mx-auto max-w-md py-20 text-center">
        <h1 class="text-3xl font-bold">Something went wrong</h1>
        <p class="mt-2 text-slate-400">A temporary hiccup on our end — your data is safe. Try again in a moment.</p>
        <p class="mt-6 text-sm text-slate-400">
          <a href={c.req.path} class="text-violet-400 hover:underline">Reload this page</a> · <a href="/home" class="text-violet-400 hover:underline">go to your deck</a> · <a href="/" class="text-violet-400 hover:underline">home</a>
        </p>
      </div>
    </Layout>,
    500
  );
});

async function newlyStreamable(env: Env, userId: number): Promise<{ title: string; tmdbId: number; mediaType: "tv" | "movie"; services: string[] }[]> {
  const services = await userServices(env, userId);
  if (services.size === 0) return [];
  const rows = await env.DB.prepare(
    "SELECT tmdb_id, media_type, title FROM tracked WHERE user_id = ? AND status = 'watchlist' ORDER BY updated_at DESC LIMIT 15"
  )
    .bind(userId)
    .all<{ tmdb_id: number; media_type: "tv" | "movie"; title: string }>();
  const out: { title: string; tmdbId: number; mediaType: "tv" | "movie"; services: string[] }[] = [];
  for (const r of rows.results) {
    const key = `avnote:${userId}:${r.media_type}:${r.tmdb_id}`;
    if (await env.CACHE.get(key)) continue;
    const prov = await watchProviders(env, r.media_type, r.tmdb_id).catch(() => null);
    const mine = prov?.providers.flatrate?.filter((p) => services.has(p.provider_id)) ?? [];
    if (mine.length === 0) continue;
    await env.CACHE.put(key, "1", { expirationTtl: 90 * 24 * 3600 });
    out.push({ title: r.title, tmdbId: r.tmdb_id, mediaType: r.media_type, services: mine.map((p) => p.provider_name) });
  }
  return out;
}

async function sendAiringDigests(env: Env): Promise<void> {
  if (!env.RESEND_API_KEY) return;
  const today = new Date().toISOString().slice(0, 10);
  const users = await env.DB.prepare("SELECT id, email, unsub_token FROM users WHERE remind_email = 1").all<{ id: number; email: string; unsub_token: string | null }>();
  for (const u of users.results) {
    let unsubToken = u.unsub_token;
    if (!unsubToken) {
      unsubToken = crypto.randomUUID();
      await env.DB.prepare("UPDATE users SET unsub_token = ? WHERE id = ?").bind(unsubToken, u.id).run();
    }
    const unsubUrl = `${env.SITE_URL}/unsubscribe/${unsubToken}`;
    const items = (await upcomingItems(env, u.id)).filter((it) => it.airDate === today);
    const streamable = await newlyStreamable(env, u.id).catch(() => []);
    if (items.length === 0 && streamable.length === 0) continue;
    const lines = items.map((it) => {
      const isTv = it.mediaType === "tv" && it.season != null && it.episode != null;
      const label = isTv
        ? ` S${String(it.season).padStart(2, "0")}E${String(it.episode).padStart(2, "0")}${it.episodeName ? ` \u2014 ${it.episodeName}` : ""}`
        : " \u2014 movie release";
      return `<li style=\"margin:6px 0\"><a href=\"${env.SITE_URL}/${isTv ? "shows" : "movies"}/${it.tmdbId}-${slugify(it.title)}\" style=\"color:#7c3aed\">${it.title}</a>${label}</li>`;
    });
    const streamLines = streamable.map(
      (s) =>
        `<li style=\"margin:6px 0\"><a href=\"${env.SITE_URL}/${s.mediaType === "tv" ? "shows" : "movies"}/${s.tmdbId}-${slugify(s.title)}\" style=\"color:#7c3aed\">${s.title}</a> \u2014 on ${s.services.join(", ")}</li>`
    );
    const airingBlock = items.length ? `<p>These titles you track air or release today:</p><ul>${lines.join("")}</ul>` : "";
    const streamBlock = streamable.length
      ? `<p>From your watchlist, now streamable on your services:</p><ul>${streamLines.join("")}</ul>`
      : "";
    const subject = items.length
      ? `Airing today: ${items[0].title}${items.length > 1 ? ` and ${items.length - 1} more` : ""}`
      : `Now streamable: ${streamable[0].title}${streamable.length > 1 ? ` and ${streamable.length - 1} more` : ""}`;
    await sendEmail(
      env,
      u.email,
      subject,
      `${airingBlock}${streamBlock}<p style=\"color:#64748b;font-size:13px\">You get this because email reminders are on \u2014 <a href=\"${unsubUrl}\" style=\"color:#64748b\">unsubscribe</a> or manage them on your <a href=\"${env.SITE_URL}/calendar\" style=\"color:#64748b\">calendar page</a>.</p>`,
      {
        "List-Unsubscribe": `<${unsubUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
    );
  }
}

async function submitSitemapToIndexNow(env: Env): Promise<void> {
  if (!env.INDEXNOW_KEY) return;
  const res = await fetch(`${env.SITE_URL}/sitemap.xml`);
  if (!res.ok) return;
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const host = new URL(env.SITE_URL).host;
  for (let i = 0; i < urls.length; i += 100) {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: env.INDEXNOW_KEY,
        keyLocation: `${env.SITE_URL}/${env.INDEXNOW_KEY}.txt`,
        urlList: urls.slice(i, i + 100),
      }),
    });
  }
}

async function pruneAnalytics(env: Env): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM analytics_events WHERE ts < datetime('now', '-90 days')"),
    env.DB.prepare("DELETE FROM search_queries WHERE ts < datetime('now', '-90 days')"),
  ]);
}

export default {
  fetch: app.fetch,
  scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(sendAiringDigests(env));
    ctx.waitUntil(pruneAnalytics(env).catch(() => {}));
    if (new Date().getUTCDay() === 1) ctx.waitUntil(submitSitemapToIndexNow(env).catch(() => {}));
  },
};
