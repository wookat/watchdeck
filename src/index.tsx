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
  recommendations,
  slugify,
} from "./tmdb";
import { parseTvTimeZip, type ParsedImport } from "./importer";
import {
  Layout,
  Landing,
  AuthForm,
  HomePage,
  SearchPage,
  TrendingSection,
  ShowPage,
  MoviePage,
  LibraryPage,
  CalendarPage,
  ImportPage,
  StatsPage,
  BrowseIndex,
  BrowseGenre,
  type UserStats,
  type NextUpItem,
  type LibraryRow,
  type CalendarItem,
} from "./views";

const app = new Hono<AppContext>();

app.use("*", (c, next) =>
  csrf({ origin: (origin) => origin === new URL(c.env.SITE_URL).origin || origin === new URL(c.req.url).origin })(c, next)
);

async function rateLimit(c: { env: { CACHE: KVNamespace }; req: { header: (n: string) => string | undefined } }, bucket: string, limit: number): Promise<boolean> {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const key = `rl:${bucket}:${ip}`;
  const count = parseInt((await c.env.CACHE.get(key)) ?? "0", 10) + 1;
  await c.env.CACHE.put(key, String(count), { expirationTtl: 600 });
  return count <= limit;
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
  return c.html(
    <Layout user={null} canonical={c.env.SITE_URL + "/"}>
      <Landing subscribed={c.req.query("subscribed") === "1"} />
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

  const nextUp: NextUpItem[] = [];
  for (const t of tracked.results) {
    try {
      const details = await tvDetails(c.env, t.tmdb_id);
      const watched = await c.env.DB.prepare(
        "SELECT season, episode FROM episode_watches WHERE user_id = ? AND tmdb_id = ?"
      )
        .bind(user.id, t.tmdb_id)
        .all<{ season: number; episode: number }>();
      const seen = new Set(watched.results.map((w) => `${w.season}x${w.episode}`));
      outer: for (const s of details.seasons.filter((s) => s.season_number > 0)) {
        const season = await seasonDetails(c.env, t.tmdb_id, s.season_number);
        for (const ep of season.episodes) {
          if (ep.air_date && ep.air_date <= new Date().toISOString().slice(0, 10) && !seen.has(`${ep.season_number}x${ep.episode_number}`)) {
            nextUp.push({
              tmdbId: t.tmdb_id,
              title: details.name,
              posterPath: details.poster_path,
              season: ep.season_number,
              episode: ep.episode_number,
              episodeName: ep.name,
              airDate: ep.air_date,
            });
            break outer;
          }
        }
      }
    } catch {
      // TMDB hiccup on one show shouldn't kill the page
    }
  }
  const wl = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM tracked WHERE user_id = ? AND status = 'watchlist'")
    .bind(user.id)
    .first<{ n: number }>();
  return c.html(
    <Layout user={user} title="Next up">
      <HomePage nextUp={nextUp} watchlistCount={wl?.n ?? 0} hasAnything={tracked.results.length > 0} />
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
  return c.html(
    <Layout user={user} title={`Search: ${q}`}>
      <SearchPage q={q} results={res.results} />
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
  let tracked: { status: string } | null = null;
  if (user) {
    const rows = await c.env.DB.prepare("SELECT season, episode FROM episode_watches WHERE user_id = ? AND tmdb_id = ?")
      .bind(user.id, id)
      .all<{ season: number; episode: number }>();
    watched = new Set(rows.results.map((r) => `${r.season}x${r.episode}`));
    tracked = await c.env.DB.prepare("SELECT status FROM tracked WHERE user_id = ? AND tmdb_id = ? AND media_type = 'tv'")
      .bind(user.id, id)
      .first<{ status: string }>();
  }
  let recs: Awaited<ReturnType<typeof recommendations>>["results"] = [];
  try {
    recs = (await recommendations(c.env, "tv", id)).results;
  } catch {}
  return c.html(
    <Layout
      user={user}
      title={show.name}
      description={show.overview?.slice(0, 155)}
      canonical={`${c.env.SITE_URL}/shows/${show.id}-${slugify(show.name)}`}
    >
      <ShowPage show={show} season={season} watched={watched} tracked={tracked} user={user} recs={recs} />
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
  let tracked: { status: string } | null = null;
  if (user) {
    watched = !!(await c.env.DB.prepare("SELECT 1 FROM movie_watches WHERE user_id = ? AND tmdb_id = ?").bind(user.id, id).first());
    tracked = await c.env.DB.prepare("SELECT status FROM tracked WHERE user_id = ? AND tmdb_id = ? AND media_type = 'movie'")
      .bind(user.id, id)
      .first<{ status: string }>();
  }
  let recs: Awaited<ReturnType<typeof recommendations>>["results"] = [];
  try {
    recs = (await recommendations(c.env, "movie", id)).results;
  } catch {}
  return c.html(
    <Layout
      user={user}
      title={movie.title}
      description={movie.overview?.slice(0, 155)}
      canonical={`${c.env.SITE_URL}/movies/${movie.id}-${slugify(movie.title)}`}
    >
      <MoviePage movie={movie} watched={watched} tracked={tracked} user={user} recs={recs} />
    </Layout>
  );
});

app.get("/library", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  const status = c.req.query("status") ?? "all";
  const cols =
    "tmdb_id, media_type, title, poster_path, status, (SELECT COUNT(*) FROM episode_watches w WHERE w.user_id = tracked.user_id AND w.tmdb_id = tracked.tmdb_id) AS eps_watched";
  const rows =
    status === "all"
      ? await c.env.DB.prepare(`SELECT ${cols} FROM tracked WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200`)
          .bind(user.id)
          .all<LibraryRow>()
      : await c.env.DB.prepare(`SELECT ${cols} FROM tracked WHERE user_id = ? AND status = ? ORDER BY updated_at DESC LIMIT 200`)
          .bind(user.id, status)
          .all<LibraryRow>();
  const sort = ["recent", "title", "progress"].includes(c.req.query("sort") ?? "") ? c.req.query("sort")! : "recent";
  const sorted = [...rows.results];
  if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === "progress") sorted.sort((a, b) => b.eps_watched - a.eps_watched);
  return c.html(
    <Layout user={user} title="Library">
      <LibraryPage rows={sorted} status={status} sort={sort} />
    </Layout>
  );
});

async function upcomingItems(env: AppContext["Bindings"], userId: number): Promise<CalendarItem[]> {
  const tracked = await env.DB.prepare(
    "SELECT tmdb_id FROM tracked WHERE user_id = ? AND media_type = 'tv' AND status IN ('watching','watchlist') LIMIT 30"
  )
    .bind(userId)
    .all<{ tmdb_id: number }>();
  const items: CalendarItem[] = [];
  for (const t of tracked.results) {
    try {
      const d = await tvDetails(env, t.tmdb_id);
      if (d.next_episode_to_air?.air_date) {
        items.push({
          tmdbId: d.id,
          title: d.name,
          posterPath: d.poster_path,
          season: d.next_episode_to_air.season_number,
          episode: d.next_episode_to_air.episode_number,
          episodeName: d.next_episode_to_air.name,
          airDate: d.next_episode_to_air.air_date,
        });
      }
    } catch {}
  }
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

app.get("/browse", async (c) => {
  const [tv, movie] = await Promise.all([genreList(c.env, "tv"), genreList(c.env, "movie")]);
  return c.html(
    <Layout
      user={c.get("user")}
      title="Browse TV shows & movies by genre"
      description="Explore popular TV shows and movies by genre and start tracking them for free on WatchDeck."
      canonical={`${c.env.SITE_URL}/browse`}
    >
      <BrowseIndex tvGenres={tv.genres} movieGenres={movie.genres} />
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
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
  const res = await discoverByGenre(c.env, type, genreId, page);
  const base = `${c.env.SITE_URL}/browse/${type}/${genre.id}-${slugify(genre.name)}`;
  return c.html(
    <Layout
      user={c.get("user")}
      title={`${genre.name} ${type === "tv" ? "TV shows" : "movies"} to watch`}
      description={`Popular ${genre.name.toLowerCase()} ${type === "tv" ? "TV shows" : "movies"} to discover and track for free on WatchDeck.`}
      canonical={page === 1 ? base : `${base}?page=${page}`}
    >
      <BrowseGenre type={type} genre={genre} results={res.results} page={page} totalPages={res.total_pages} />
    </Layout>
  );
});

app.get("/stats", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  const [eps, movies, tracked, completed, topShows, byMonth] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM episode_watches WHERE user_id = ?").bind(user.id).first<{ n: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM movie_watches WHERE user_id = ?").bind(user.id).first<{ n: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM tracked WHERE user_id = ? AND media_type = 'tv'").bind(user.id).first<{ n: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM tracked WHERE user_id = ? AND media_type = 'tv' AND status = 'completed'").bind(user.id).first<{ n: number }>(),
    c.env.DB.prepare(
      `SELECT t.title, t.tmdb_id, COUNT(*) AS eps FROM episode_watches w
       JOIN tracked t ON t.user_id = w.user_id AND t.tmdb_id = w.tmdb_id AND t.media_type = 'tv'
       WHERE w.user_id = ? GROUP BY w.tmdb_id ORDER BY eps DESC LIMIT 10`
    ).bind(user.id).all<{ title: string; tmdb_id: number; eps: number }>(),
    c.env.DB.prepare(
      `SELECT strftime('%Y-%m', watched_at) AS month, COUNT(*) AS eps FROM episode_watches
       WHERE user_id = ? AND watched_at >= date('now', '-12 months') GROUP BY month ORDER BY month`
    ).bind(user.id).all<{ month: string; eps: number }>(),
  ]);
  const stats: UserStats = {
    epsWatched: eps?.n ?? 0,
    moviesWatched: movies?.n ?? 0,
    showsTracked: tracked?.n ?? 0,
    completedShows: completed?.n ?? 0,
    topShows: topShows.results,
    byMonth: byMonth.results,
  };
  return c.html(
    <Layout user={user} title="Stats">
      <StatsPage stats={stats} />
    </Layout>
  );
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
  }
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
  return c.redirect(String(form.redirect ?? "/home"));
});

// step 1: parse the TV Time ZIP into JSON (no TMDB calls here)
app.post("/api/import/parse", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "auth" }, 401);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.length > 30 * 1024 * 1024) return c.json({ error: "File too large (max 30 MB)" }, 413);
  try {
    const parsed = parseTvTimeZip(bytes);
    if (parsed.shows.length === 0 && parsed.movies.length === 0) {
      return c.json({ error: "No TV Time data found in this ZIP. Make sure it's the GDPR export." }, 422);
    }
    return c.json(parsed);
  } catch {
    return c.json({ error: "Could not read that ZIP file." }, 422);
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

  return c.json({ showsImported, episodesImported, moviesImported, unmatched: unmatchedNames.length, unmatchedNames });
});

// ---------- seo ----------
app.get("/robots.txt", (c) =>
  c.text(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /home\nDisallow: /library\nDisallow: /calendar\nDisallow: /import\n\nSitemap: ${c.env.SITE_URL}/sitemap.xml\n`)
);

app.get("/sitemap.xml", async (c) => {
  const urls: string[] = [`${c.env.SITE_URL}/`, `${c.env.SITE_URL}/search`, `${c.env.SITE_URL}/browse`, `${c.env.SITE_URL}/signup`, `${c.env.SITE_URL}/login`];
  try {
    const [shows, movies, tvGenres, movieGenres] = await Promise.all([
      trendingTv(c.env),
      trendingMovies(c.env),
      genreList(c.env, "tv"),
      genreList(c.env, "movie"),
    ]);
    for (const s of shows.results) urls.push(`${c.env.SITE_URL}/shows/${s.id}-${slugify(s.name ?? "")}`);
    for (const m of movies.results) urls.push(`${c.env.SITE_URL}/movies/${m.id}-${slugify(m.title ?? "")}`);
    for (const g of tvGenres.genres) urls.push(`${c.env.SITE_URL}/browse/tv/${g.id}-${slugify(g.name)}`);
    for (const g of movieGenres.genres) urls.push(`${c.env.SITE_URL}/browse/movie/${g.id}-${slugify(g.name)}`);
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

app.get("/api/stats", async (c) => {
  const user = c.get("user");
  if (!user || (c.env.ADMIN_EMAIL && user.email !== c.env.ADMIN_EMAIL.toLowerCase())) return c.json({ error: "forbidden" }, 403);
  const rows = await c.env.DB.prepare(
    "SELECT date(ts) AS day, COUNT(*) AS views FROM analytics_events WHERE ua_class != 'bot' GROUP BY day ORDER BY day DESC LIMIT 30"
  ).all();
  return c.json(rows.results);
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
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "WatchDeck <watchdeck@zalize.com>",
        to: [u.email],
        subject: `Airing today: ${items[0].title}${items.length > 1 ? ` and ${items.length - 1} more` : ""}`,
        html: `<p>These shows you track air new episodes today:</p><ul>${lines.join("")}</ul><p style=\"color:#64748b;font-size:13px\">You get this because email reminders are on \u2014 turn them off any time on your <a href=\"${env.SITE_URL}/calendar\">calendar page</a>.</p>`,
      }),
    }).catch(() => {});
  }
}

export default {
  fetch: app.fetch,
  scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(sendAiringDigests(env));
  },
};
