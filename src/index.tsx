import { Hono } from "hono";
import { csrf } from "hono/csrf";
import type { AppContext, Env } from "./types";
import { hashPassword, verifyPassword, createSession, destroySession, loadUser } from "./auth";
import {
  searchMulti,
  searchTv,
  searchMovie,
  tvDetails,
  seasonDetails,
  movieDetails,
  trendingTv,
  trendingMovies,
  genreList,
  discoverByGenre,
  discoverByNetwork,
  discoverByYear,
  discoverPopular,
  NETWORKS,
  recommendations,
  watchProviders,
  slugify,
  type SearchResult,
  topCast,
  type CastMember,
} from "./tmdb";
import { parseTvTimeZip, parseGenericCsv, type ParsedImport } from "./importer";
import { sendEmail, welcomeEmail, resetEmail } from "./email";
import { shareOgImage } from "./og";
import {
  Layout,
  Landing,
  AuthForm,
  ForgotForm,
  ResetForm,
  HomePage,
  SearchPage,
  TrendingSection,
  ShowPage,
  MoviePage,
  LibraryPage,
  CalendarPage,
  ImportPage,
  StatsPage,
  PublicProfilePage,
  BrowseIndex,
  BrowseGenre,
  BrowseNetwork,
  BrowseYear,
  type UserStats,
  type NextUpItem,
  type HistoryItem,
  HistoryPage,
  SettingsPage,
  PrivacyPage,
  TermsPage,
  type WatchlistPreviewItem,
  type LibraryRow,
  type CalendarItem,
} from "./views";

const app = new Hono<AppContext>();

app.use("*", (c, next) =>
  csrf({ origin: (origin) => origin === new URL(c.env.SITE_URL).origin || origin === new URL(c.req.url).origin })(c, next)
);

app.use("*", async (c, next) => {
  await next();
  const h = c.res.headers;
  h.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  h.set("x-content-type-options", "nosniff");
  h.set("x-frame-options", "DENY");
  h.set("referrer-policy", "strict-origin-when-cross-origin");
  h.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  if (c.res.headers.get("content-type")?.includes("text/html")) {
    h.set(
      "content-security-policy",
      "default-src 'self'; img-src 'self' https://image.tmdb.org data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
    );
  }
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
        "@type": "WebSite",
        name: "WatchDeck",
        url: c.env.SITE_URL + "/",
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${c.env.SITE_URL}/search?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
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
app.get("/signup", (c) => c.html(<Layout user={c.get("user")} title="Sign up"><AuthForm mode="signup" /></Layout>));
app.get("/login", (c) => c.html(<Layout user={c.get("user")} title="Log in"><AuthForm mode="login" /></Layout>));

app.post("/signup", async (c) => {
  if (!(await rateLimit(c, "signup", 10))) {
    return c.html(<Layout user={null} title="Sign up"><AuthForm mode="signup" error="Too many attempts. Please try again in a few minutes." /></Layout>, 429);
  }
  const form = await c.req.parseBody();
  const email = String(form.email ?? "").trim().toLowerCase();
  const password = String(form.password ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 8) {
    return c.html(<Layout user={null} title="Sign up"><AuthForm mode="signup" error="Enter a valid email and a password of 8+ characters." /></Layout>, 400);
  }
  const { hash, salt } = await hashPassword(password);
  try {
    const res = await c.env.DB.prepare("INSERT INTO users (email, password_hash, salt) VALUES (?, ?, ?) RETURNING id")
      .bind(email, hash, salt)
      .first<{ id: number }>();
    await createSession(c, res!.id);
    c.executionCtx.waitUntil(sendEmail(c.env, email, ...welcomeEmail(c.env.SITE_URL)));
    return c.redirect("/import");
  } catch {
    return c.html(<Layout user={null} title="Sign up"><AuthForm mode="signup" error="That email is already registered." /></Layout>, 400);
  }
});

app.post("/login", async (c) => {
  if (!(await rateLimit(c, "login", 15))) {
    return c.html(<Layout user={null} title="Log in"><AuthForm mode="login" error="Too many attempts. Please try again in a few minutes." /></Layout>, 429);
  }
  const form = await c.req.parseBody();
  const email = String(form.email ?? "").trim().toLowerCase();
  const password = String(form.password ?? "");
  const row = await c.env.DB.prepare("SELECT id, password_hash, salt FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: number; password_hash: string; salt: string }>();
  if (!row || !(await verifyPassword(password, row.salt, row.password_hash))) {
    return c.html(<Layout user={null} title="Log in"><AuthForm mode="login" error="Wrong email or password." /></Layout>, 401);
  }
  await createSession(c, row.id);
  c.executionCtx.waitUntil(c.env.CACHE.delete(rateLimitKey(c, "login")).catch(() => {}));
  return c.redirect("/home");
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
  if (!user) return c.redirect("/login");
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
        for (const s of details.seasons.filter((s) => s.season_number > 0)) {
          const season = await seasonDetails(c.env, t.tmdb_id, s.season_number);
          for (const ep of season.episodes) {
            if (ep.air_date && ep.air_date <= today && !seen.has(`${ep.season_number}x${ep.episode_number}`)) {
              return {
                tmdbId: t.tmdb_id,
                title: details.name,
                posterPath: details.poster_path,
                season: ep.season_number,
                episode: ep.episode_number,
                episodeName: ep.name,
                airDate: ep.air_date,
              };
            }
          }
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
  return c.html(
    <Layout user={user} title="Next up">
      <HomePage nextUp={nextUp} watchlistCount={wl?.n ?? 0} hasAnything={tracked.results.length > 0 || (wl?.n ?? 0) > 0} justWatched={justWatched} watchlistPreview={watchlistPreview} />
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
  const res = await searchMulti(c.env, q);
  let libraryIds: Set<string> | undefined;
  if (user) {
    const rows = await c.env.DB.prepare("SELECT tmdb_id, media_type FROM tracked WHERE user_id = ?")
      .bind(user.id)
      .all<{ tmdb_id: number; media_type: string }>();
    libraryIds = new Set(rows.results.map((r) => `${r.media_type}:${r.tmdb_id}`));
  }
  c.executionCtx.waitUntil(
    c.env.DB.prepare("INSERT INTO search_queries (q, results) VALUES (?, ?)")
      .bind(q.slice(0, 200), res.results.length)
      .run()
      .catch(() => {})
  );
  const typeQ = c.req.query("type");
  const type = typeQ === "tv" || typeQ === "movie" ? typeQ : "all";
  return c.html(
    <Layout user={user} title={`Search: ${q}`}>
      <SearchPage q={q} results={res.results} libraryIds={libraryIds} type={type} />
    </Layout>
  );
});

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
  const seasonNum = parseInt(c.req.query("season") ?? "1", 10) || 1;
  let season = null;
  try {
    season = await seasonDetails(c.env, id, seasonNum);
  } catch {}
  let watched = new Set<string>();
  let tracked: { status: string; rating: number | null; notes: string | null } | null = null;
  if (user) {
    const rows = await c.env.DB.prepare("SELECT season, episode FROM episode_watches WHERE user_id = ? AND tmdb_id = ?")
      .bind(user.id, id)
      .all<{ season: number; episode: number }>();
    watched = new Set(rows.results.map((r) => `${r.season}x${r.episode}`));
    tracked = await c.env.DB.prepare("SELECT status, rating, notes FROM tracked WHERE user_id = ? AND tmdb_id = ? AND media_type = 'tv'")
      .bind(user.id, id)
      .first<{ status: string; rating: number | null; notes: string | null }>();
  }
  let recs: Awaited<ReturnType<typeof recommendations>>["results"] = [];
  try {
    recs = (await recommendations(c.env, "tv", id)).results;
  } catch {}
  let providers = null;
  try {
    providers = await watchProviders(c.env, "tv", id);
  } catch {}
  let cast: CastMember[] = [];
  try {
    cast = await topCast(c.env, "tv", id);
  } catch {}
  const showCanonical = `${c.env.SITE_URL}/shows/${show.id}-${slugify(show.name)}`;
  return c.html(
    <Layout
      user={user}
      title={show.name}
      description={show.overview?.slice(0, 155)}
      canonical={showCanonical}
      ogImage={show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : undefined}
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
      <ShowPage show={show} season={season} watched={watched} tracked={tracked} user={user} recs={recs} providers={providers} cast={cast} />
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
  let watched = false;
  let tracked: { status: string; rating: number | null; notes: string | null } | null = null;
  if (user) {
    watched = !!(await c.env.DB.prepare("SELECT 1 FROM movie_watches WHERE user_id = ? AND tmdb_id = ?").bind(user.id, id).first());
    tracked = await c.env.DB.prepare("SELECT status, rating, notes FROM tracked WHERE user_id = ? AND tmdb_id = ? AND media_type = 'movie'")
      .bind(user.id, id)
      .first<{ status: string; rating: number | null; notes: string | null }>();
  }
  let recs: Awaited<ReturnType<typeof recommendations>>["results"] = [];
  try {
    recs = (await recommendations(c.env, "movie", id)).results;
  } catch {}
  let providers = null;
  try {
    providers = await watchProviders(c.env, "movie", id);
  } catch {}
  let cast: CastMember[] = [];
  try {
    cast = await topCast(c.env, "movie", id);
  } catch {}
  const movieCanonical = `${c.env.SITE_URL}/movies/${movie.id}-${slugify(movie.title)}`;
  return c.html(
    <Layout
      user={user}
      title={movie.title}
      description={movie.overview?.slice(0, 155)}
      canonical={movieCanonical}
      ogImage={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : undefined}
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
      <MoviePage movie={movie} watched={watched} tracked={tracked} user={user} recs={recs} providers={providers} cast={cast} />
    </Layout>
  );
});

app.get("/library", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
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
  const rows = await c.env.DB.prepare(`SELECT ${cols} FROM tracked WHERE ${conds.join(" AND ")} ORDER BY updated_at DESC LIMIT 200`)
    .bind(...binds)
    .all<LibraryRow>();
  const sort = ["recent", "title", "progress"].includes(c.req.query("sort") ?? "") ? c.req.query("sort")! : "recent";
  const sorted = [...rows.results];
  if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === "progress") sorted.sort((a, b) => b.eps_watched - a.eps_watched);
  const countRows = await c.env.DB.prepare("SELECT status, COUNT(*) AS n FROM tracked WHERE user_id = ? GROUP BY status")
    .bind(user.id)
    .all<{ status: string; n: number }>();
  const counts = Object.fromEntries(countRows.results.map((r) => [r.status, r.n]));
  return c.html(
    <Layout user={user} title="Library">
      <LibraryPage rows={sorted} status={status} sort={sort} q={q} counts={counts} />
    </Layout>
  );
});

async function upcomingItems(env: AppContext["Bindings"], userId: number): Promise<CalendarItem[]> {
  const tracked = await env.DB.prepare(
    "SELECT tmdb_id FROM tracked WHERE user_id = ? AND media_type = 'tv' AND status IN ('watching','watchlist') LIMIT 30"
  )
    .bind(userId)
    .all<{ tmdb_id: number }>();
  const perShow = await Promise.all(
    tracked.results.map(async (t): Promise<CalendarItem | null> => {
      try {
        const d = await tvDetails(env, t.tmdb_id);
        if (!d.next_episode_to_air?.air_date) return null;
        return {
          tmdbId: d.id,
          title: d.name,
          posterPath: d.poster_path,
          season: d.next_episode_to_air.season_number,
          episode: d.next_episode_to_air.episode_number,
          episodeName: d.next_episode_to_air.name,
          airDate: d.next_episode_to_air.air_date,
        };
      } catch {
        return null;
      }
    })
  );
  const items = perShow.filter((i): i is CalendarItem => i !== null);
  items.sort((a, b) => a.airDate.localeCompare(b.airDate));
  return items;
}

app.get("/calendar", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
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
    lines.push(
      "BEGIN:VEVENT",
      `UID:wd-${it.tmdbId}-s${it.season}e${it.episode}@watchdeck.zalize.com`,
      `DTSTART;VALUE=DATE:${day}`,
      `SUMMARY:${esc(`${it.title} S${String(it.season).padStart(2, "0")}E${String(it.episode).padStart(2, "0")}${it.episodeName ? ` \u2014 ${it.episodeName}` : ""}`)}`,
      `URL:${c.env.SITE_URL}/shows/${it.tmdbId}-${slugify(it.title)}`,
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

app.get("/browse", async (c) => {
  const [tv, movie] = await Promise.all([genreList(c.env, "tv"), genreList(c.env, "movie")]);
  return c.html(
    <Layout
      user={c.get("user")}
      title="Browse TV shows & movies by genre"
      description="Explore popular TV shows and movies by genre and start tracking them for free on WatchDeck."
      canonical={`${c.env.SITE_URL}/browse`}
    >
      <BrowseIndex tvGenres={tv.genres} movieGenres={movie.genres} networks={NETWORKS} years={browseYears()} />
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
      description={`Popular TV shows on ${network.name} to discover and track for free on WatchDeck.`}
      canonical={page === 1 ? base : `${base}?page=${page}`}
      prev={page > 1 ? (page === 2 ? base : `${base}?page=${page - 1}`) : undefined}
      next={page < last ? `${base}?page=${page + 1}` : undefined}
    >
      <BrowseNetwork network={network} results={res.results} page={page} totalPages={res.total_pages} />
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
      description={`The most popular ${type === "tv" ? `TV shows that premiered in ${year}` : `movies released in ${year}`} to discover and track for free on WatchDeck.`}
      canonical={page === 1 ? base : `${base}?page=${page}`}
      prev={page > 1 ? (page === 2 ? base : `${base}?page=${page - 1}`) : undefined}
      next={page < last ? `${base}?page=${page + 1}` : undefined}
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
      description={`Popular ${genre.name.toLowerCase()} ${type === "tv" ? "TV shows" : "movies"} to discover and track for free on WatchDeck.`}
      canonical={page === 1 ? base : `${base}?page=${page}`}
      prev={page > 1 ? (page === 2 ? base : `${base}?page=${page - 1}`) : undefined}
      next={page < last ? `${base}?page=${page + 1}` : undefined}
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
    env.DB.prepare("SELECT tmdb_id, COUNT(*) AS n FROM episode_watches WHERE user_id = ? GROUP BY tmdb_id")
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
  const [eps, movies, tracked, completed, topShows, byMonth, hours] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM episode_watches WHERE user_id = ?").bind(userId).first<{ n: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM movie_watches WHERE user_id = ?").bind(userId).first<{ n: number }>(),
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
  ]);
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
    topGenres,
  };
}

app.get("/history", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  const [eps, movies] = await Promise.all([
    c.env.DB.prepare(
      `SELECT w.tmdb_id, w.season, w.episode, w.watched_at, t.title, t.poster_path
       FROM episode_watches w
       LEFT JOIN tracked t ON t.user_id = w.user_id AND t.tmdb_id = w.tmdb_id AND t.media_type = 'tv'
       WHERE w.user_id = ? ORDER BY w.watched_at DESC LIMIT 100`
    )
      .bind(user.id)
      .all<{ tmdb_id: number; season: number; episode: number; watched_at: string; title: string | null; poster_path: string | null }>(),
    c.env.DB.prepare(
      `SELECT w.tmdb_id, w.watched_at, t.title, t.poster_path
       FROM movie_watches w
       LEFT JOIN tracked t ON t.user_id = w.user_id AND t.tmdb_id = w.tmdb_id AND t.media_type = 'movie'
       WHERE w.user_id = ? ORDER BY w.watched_at DESC LIMIT 100`
    )
      .bind(user.id)
      .all<{ tmdb_id: number; watched_at: string; title: string | null; poster_path: string | null }>(),
  ]);
  const items: HistoryItem[] = [
    ...eps.results.map((e) => ({
      tmdbId: e.tmdb_id,
      mediaType: "tv" as const,
      title: e.title ?? `Show #${e.tmdb_id}`,
      posterPath: e.poster_path,
      season: e.season,
      episode: e.episode,
      watchedAt: e.watched_at,
    })),
    ...movies.results.map((m) => ({
      tmdbId: m.tmdb_id,
      mediaType: "movie" as const,
      title: m.title ?? `Movie #${m.tmdb_id}`,
      posterPath: m.poster_path,
      season: null,
      episode: null,
      watchedAt: m.watched_at,
    })),
  ]
    .sort((a, b) => (a.watchedAt < b.watchedAt ? 1 : -1))
    .slice(0, 100);
  return c.html(
    <Layout user={user} title="History">
      <HistoryPage items={items} />
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

app.get("/terms", (c) =>
  c.html(
    <Layout user={c.get("user")} title="Terms of service" canonical={`${c.env.SITE_URL}/terms`}>
      <TermsPage />
    </Layout>
  )
);

app.get("/settings", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  const saved = c.req.query("saved") ?? undefined;
  const error = c.req.query("error") ?? undefined;
  return c.html(
    <Layout user={user} title="Settings">
      <SettingsPage user={user} saved={saved} error={error} />
    </Layout>
  );
});

app.get("/api/export", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  const [tracked, episodes, movies] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT tmdb_id, media_type, title, status, rating, notes, created_at, updated_at FROM tracked WHERE user_id = ? ORDER BY title").bind(user.id),
    c.env.DB.prepare("SELECT tmdb_id, season, episode, watched_at FROM episode_watches WHERE user_id = ? ORDER BY tmdb_id, season, episode").bind(user.id),
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

app.post("/api/settings/profile", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  const form = await c.req.parseBody();
  const name = String(form.display_name ?? "").trim().slice(0, 40);
  await c.env.DB.prepare("UPDATE users SET display_name = ? WHERE id = ?").bind(name || null, user.id).run();
  return c.redirect("/settings?saved=" + encodeURIComponent("Profile updated."));
});

app.post("/api/settings/password", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
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
  if (!user) return c.redirect("/login");
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
    c.env.DB.prepare("DELETE FROM feed_tokens WHERE user_id = ?").bind(user.id),
    c.env.DB.prepare("DELETE FROM password_resets WHERE user_id = ?").bind(user.id),
    c.env.DB.prepare("DELETE FROM imports WHERE user_id = ?").bind(user.id),
    c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
    c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id),
  ]);
  await destroySession(c);
  return c.redirect("/");
});

app.get("/stats", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
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
  if (!user) return c.redirect("/login");
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

async function shareProfile(env: Env, token: string): Promise<{ name: string; stats: UserStats } | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const row = await env.DB.prepare(
    "SELECT u.id, u.display_name, u.email FROM share_tokens s JOIN users u ON u.id = s.user_id WHERE s.token = ?"
  ).bind(token).first<{ id: number; display_name: string | null; email: string }>();
  if (!row) return null;
  return { name: row.display_name || row.email.split("@")[0], stats: await userStats(env, row.id) };
}

app.get("/u/:token", async (c) => {
  const token = c.req.param("token");
  const profile = await shareProfile(c.env, token);
  if (!profile) return c.notFound();
  return c.html(
    <Layout
      user={c.get("user")}
      title={`${profile.name}'s watch stats`}
      description={`${profile.stats.hoursWatched} hours of TV & movies \u2014 ${profile.stats.epsWatched} episodes and ${profile.stats.moviesWatched} movies tracked free on WatchDeck.`}
      canonical={`${c.env.SITE_URL}/u/${token}`}
      ogImage={`${c.env.SITE_URL}/u/${token}/og.png`}
    >
      <PublicProfilePage stats={profile.stats} name={profile.name} />
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
      <ImportPage />
    </Layout>
  );
});

// ---------- api ----------
app.post("/api/waitlist", async (c) => {
  const form = await c.req.parseBody();
  const email = String(form.email ?? "").trim().toLowerCase();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    await c.env.DB.prepare("INSERT OR IGNORE INTO email_signups (email, source) VALUES (?, 'landing')").bind(email).run();
  }
  return c.redirect("/?subscribed=1");
});

app.post("/api/rate", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
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
  return c.redirect(String(form.redirect ?? "/library"));
});

app.post("/api/notes", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
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
  return c.redirect(String(form.redirect ?? "/library"));
});

app.post("/api/track", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
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
  return c.redirect(String(form.redirect ?? "/home"));
});

app.post("/api/untrack", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  const form = await c.req.parseBody();
  const tmdbId = parseInt(String(form.tmdb_id), 10);
  const mediaType = String(form.media_type) === "movie" ? "movie" : "tv";
  await c.env.DB.prepare("DELETE FROM tracked WHERE user_id = ? AND tmdb_id = ? AND media_type = ?")
    .bind(user.id, tmdbId, mediaType)
    .run();
  return c.redirect(String(form.redirect ?? "/library"));
});

app.post("/api/watch", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
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
  return c.redirect(String(form.redirect ?? "/home"));
});

app.post("/api/reminders", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  const form = await c.req.parseBody();
  const enabled = String(form.enabled) === "1" ? 1 : 0;
  await c.env.DB.prepare("UPDATE users SET remind_email = ? WHERE id = ?").bind(enabled, user.id).run();
  return c.redirect("/calendar");
});

app.post("/api/watch-season", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
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
    return c.redirect(String(form.redirect ?? "/home"));
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
  return c.redirect(String(form.redirect ?? "/home"));
});

app.post("/api/watch-up-to", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  const form = await c.req.parseBody();
  const tmdbId = parseInt(String(form.tmdb_id), 10);
  const targetSeason = parseInt(String(form.season), 10);
  const targetEpisode = parseInt(String(form.episode), 10);
  if (!Number.isFinite(tmdbId) || !Number.isFinite(targetSeason) || !Number.isFinite(targetEpisode)) {
    return c.redirect(String(form.redirect ?? "/home"));
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
  return c.redirect(String(form.redirect ?? "/home"));
});

app.post("/api/watch-movie", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  const form = await c.req.parseBody();
  const tmdbId = parseInt(String(form.tmdb_id), 10);
  if (String(form.undo) === "1") {
    await c.env.DB.prepare("DELETE FROM movie_watches WHERE user_id = ? AND tmdb_id = ?").bind(user.id, tmdbId).run();
    await c.env.DB.prepare(
      "UPDATE tracked SET status = 'watchlist', updated_at = datetime('now') WHERE user_id = ? AND tmdb_id = ? AND media_type = 'movie' AND status = 'completed'"
    )
      .bind(user.id, tmdbId)
      .run();
  } else {
    await c.env.DB.prepare("INSERT OR IGNORE INTO movie_watches (user_id, tmdb_id) VALUES (?, ?)").bind(user.id, tmdbId).run();
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
  return c.redirect(String(form.redirect ?? "/home"));
});

// step 1: parse the uploaded export (TV Time ZIP, or a Trakt/Serializd-style CSV) into JSON (no TMDB calls here)
app.post("/api/import/parse", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "auth" }, 401);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.length > 30 * 1024 * 1024) return c.json({ error: "File too large (max 30 MB)" }, 413);
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  try {
    const parsed = isZip ? parseTvTimeZip(bytes) : parseGenericCsv(new TextDecoder().decode(bytes));
    if (parsed.shows.length === 0 && parsed.movies.length === 0) {
      logFunnel(c, "import-parse-empty");
      return c.json(
        { error: isZip ? "No TV Time data found in this ZIP. Make sure it's the GDPR export." : "No shows or movies found in this CSV \u2014 it needs a title column." },
        422
      );
    }
    logFunnel(c, "import-parse-ok");
    return c.json(parsed);
  } catch {
    logFunnel(c, "import-parse-fail");
    return c.json({ error: isZip ? "Could not read that ZIP file." : "Could not read that file. Upload a TV Time ZIP or a CSV export." }, 422);
  }
});

// step 2: client sends batches (<=20 titles) — we match via TMDB and insert
app.post("/api/import/batch", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "auth" }, 401);
  const batch = (await c.req.json()) as ParsedImport;
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
      await c.env.DB.prepare(
        `INSERT INTO tracked (user_id, tmdb_id, media_type, title, poster_path, status, source)
         VALUES (?, ?, 'tv', ?, ?, ?, 'tvtime')
         ON CONFLICT(user_id, tmdb_id, media_type) DO NOTHING`
      )
        .bind(user.id, match.id, title, match.poster_path, allWatched ? "watching" : "watchlist")
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
      await c.env.DB.batch([
        c.env.DB.prepare(
          `INSERT INTO tracked (user_id, tmdb_id, media_type, title, poster_path, status, source)
           VALUES (?, ?, 'movie', ?, ?, 'completed', 'tvtime')
           ON CONFLICT(user_id, tmdb_id, media_type) DO NOTHING`
        ).bind(user.id, match.id, match.title ?? movie.name, match.poster_path),
        c.env.DB.prepare(
          "INSERT OR IGNORE INTO movie_watches (user_id, tmdb_id, watched_at) VALUES (?, ?, COALESCE(?, datetime('now')))"
        ).bind(user.id, match.id, movie.watchedAt),
      ]);
      moviesImported++;
    } catch {
      unmatchedNames.push(movie.name);
    }
  }

  await c.env.DB.prepare(
    "INSERT INTO imports (user_id, source, shows_imported, episodes_imported, movies_imported, unmatched) VALUES (?, 'tvtime', ?, ?, ?, ?)"
  )
    .bind(user.id, showsImported, episodesImported, moviesImported, unmatchedNames.length)
    .run();

  invalidateHours(c, user.id);
  logFunnel(c, "import-batch-done");
  return c.json({ showsImported, episodesImported, moviesImported, unmatched: unmatchedNames.length, unmatchedNames });
});

// ---------- seo ----------
app.get("/robots.txt", (c) =>
  c.text(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /home\nDisallow: /library\nDisallow: /calendar\nDisallow: /import\n\nSitemap: ${c.env.SITE_URL}/sitemap.xml\n`)
);

app.get("/sitemap.xml", async (c) => {
  const urls: string[] = [`${c.env.SITE_URL}/`, `${c.env.SITE_URL}/search`, `${c.env.SITE_URL}/browse`, `${c.env.SITE_URL}/signup`, `${c.env.SITE_URL}/login`, `${c.env.SITE_URL}/privacy`, `${c.env.SITE_URL}/terms`];
  try {
    const [shows, movies, tvGenres, movieGenres, ...popular] = await Promise.all([
      trendingTv(c.env),
      trendingMovies(c.env),
      genreList(c.env, "tv"),
      genreList(c.env, "movie"),
      discoverPopular(c.env, "tv", 1),
      discoverPopular(c.env, "tv", 2),
      discoverPopular(c.env, "movie", 1),
      discoverPopular(c.env, "movie", 2),
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
      const type = i < 2 ? "tv" : "movie";
      for (const r of p.results) pushTitle(type, r.id, (type === "tv" ? r.name : r.title) ?? "");
    }
    for (const g of tvGenres.genres) urls.push(`${c.env.SITE_URL}/browse/tv/${g.id}-${slugify(g.name)}`);
    for (const g of movieGenres.genres) urls.push(`${c.env.SITE_URL}/browse/movie/${g.id}-${slugify(g.name)}`);
    for (const n of NETWORKS) urls.push(`${c.env.SITE_URL}/browse/network/${n.id}-${slugify(n.name)}`);
    for (const y of browseYears()) {
      urls.push(`${c.env.SITE_URL}/browse/year/tv/${y}`, `${c.env.SITE_URL}/browse/year/movie/${y}`);
    }
  } catch {}
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u}</loc></url>`)
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
      <div class="py-20 text-center">
        <h1 class="text-3xl font-bold">404</h1>
        <p class="mt-2 text-slate-400">
          That page drifted off the deck. <a href="/" class="text-violet-400 hover:underline">Go home</a>.
        </p>
      </div>
    </Layout>,
    404
  )
);

async function sendAiringDigests(env: Env): Promise<void> {
  if (!env.RESEND_API_KEY) return;
  const today = new Date().toISOString().slice(0, 10);
  const users = await env.DB.prepare("SELECT id, email FROM users WHERE remind_email = 1").all<{ id: number; email: string }>();
  for (const u of users.results) {
    const items = (await upcomingItems(env, u.id)).filter((it) => it.airDate === today);
    if (items.length === 0) continue;
    const lines = items.map(
      (it) =>
        `<li style=\"margin:6px 0\"><a href=\"${env.SITE_URL}/shows/${it.tmdbId}-${slugify(it.title)}\" style=\"color:#7c3aed\">${it.title}</a> S${String(it.season).padStart(2, "0")}E${String(it.episode).padStart(2, "0")}${it.episodeName ? ` \u2014 ${it.episodeName}` : ""}</li>`
    );
    await sendEmail(
      env,
      u.email,
      `Airing today: ${items[0].title}${items.length > 1 ? ` and ${items.length - 1} more` : ""}`,
      `<p>These shows you track air new episodes today:</p><ul>${lines.join("")}</ul><p style=\"color:#64748b;font-size:13px\">You get this because email reminders are on \u2014 turn them off any time on your <a href=\"${env.SITE_URL}/calendar\">calendar page</a>.</p>`
    );
  }
}

export default {
  fetch: app.fetch,
  scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(sendAiringDigests(env));
  },
};
