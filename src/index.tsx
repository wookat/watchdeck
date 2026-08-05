import { Hono } from "hono";
import type { AppContext } from "./types";
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
  type NextUpItem,
  type LibraryRow,
  type CalendarItem,
} from "./views";

const app = new Hono<AppContext>();

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
      <Landing />
    </Layout>
  );
});

// ---------- auth ----------
app.get("/signup", (c) => c.html(<Layout user={c.get("user")} title="Sign up"><AuthForm mode="signup" /></Layout>));
app.get("/login", (c) => c.html(<Layout user={c.get("user")} title="Log in"><AuthForm mode="login" /></Layout>));

app.post("/signup", async (c) => {
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
  return c.html(
    <Layout
      user={user}
      title={show.name}
      description={show.overview?.slice(0, 155)}
      canonical={`${c.env.SITE_URL}/shows/${show.id}-${slugify(show.name)}`}
    >
      <ShowPage show={show} season={season} watched={watched} tracked={tracked} user={user} />
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
  return c.html(
    <Layout
      user={user}
      title={movie.title}
      description={movie.overview?.slice(0, 155)}
      canonical={`${c.env.SITE_URL}/movies/${movie.id}-${slugify(movie.title)}`}
    >
      <MoviePage movie={movie} watched={watched} tracked={tracked} user={user} />
    </Layout>
  );
});

app.get("/library", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  const status = c.req.query("status") ?? "all";
  const rows =
    status === "all"
      ? await c.env.DB.prepare("SELECT tmdb_id, media_type, title, poster_path, status FROM tracked WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200")
          .bind(user.id)
          .all<LibraryRow>()
      : await c.env.DB.prepare(
          "SELECT tmdb_id, media_type, title, poster_path, status FROM tracked WHERE user_id = ? AND status = ? ORDER BY updated_at DESC LIMIT 200"
        )
          .bind(user.id, status)
          .all<LibraryRow>();
  return c.html(
    <Layout user={user} title="Library">
      <LibraryPage rows={rows.results} status={status} />
    </Layout>
  );
});

app.get("/calendar", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  const tracked = await c.env.DB.prepare(
    "SELECT tmdb_id FROM tracked WHERE user_id = ? AND media_type = 'tv' AND status IN ('watching','watchlist') LIMIT 30"
  )
    .bind(user.id)
    .all<{ tmdb_id: number }>();
  const items: CalendarItem[] = [];
  for (const t of tracked.results) {
    try {
      const d = await tvDetails(c.env, t.tmdb_id);
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
  return c.html(
    <Layout user={user} title="Calendar">
      <CalendarPage items={items} />
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

app.post("/api/watch-movie", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login");
  const form = await c.req.parseBody();
  const tmdbId = parseInt(String(form.tmdb_id), 10);
  if (String(form.undo) === "1") {
    await c.env.DB.prepare("DELETE FROM movie_watches WHERE user_id = ? AND tmdb_id = ?").bind(user.id, tmdbId).run();
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
  let unmatched = 0;

  for (const show of (batch.shows ?? []).slice(0, 20)) {
    try {
      const res = await searchTv(c.env, show.name);
      const match = res.results[0];
      if (!match) {
        unmatched++;
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
      unmatched++;
    }
  }

  for (const movie of (batch.movies ?? []).slice(0, 20)) {
    try {
      const res = await searchMovie(c.env, movie.name);
      const match = res.results[0];
      if (!match) {
        unmatched++;
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
      unmatched++;
    }
  }

  await c.env.DB.prepare(
    "INSERT INTO imports (user_id, source, shows_imported, episodes_imported, movies_imported, unmatched) VALUES (?, 'tvtime', ?, ?, ?, ?)"
  )
    .bind(user.id, showsImported, episodesImported, moviesImported, unmatched)
    .run();

  return c.json({ showsImported, episodesImported, moviesImported, unmatched });
});

// ---------- seo ----------
app.get("/robots.txt", (c) =>
  c.text(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /home\nDisallow: /library\nDisallow: /calendar\nDisallow: /import\n\nSitemap: ${c.env.SITE_URL}/sitemap.xml\n`)
);

app.get("/sitemap.xml", async (c) => {
  const urls: string[] = [`${c.env.SITE_URL}/`, `${c.env.SITE_URL}/search`, `${c.env.SITE_URL}/signup`, `${c.env.SITE_URL}/login`];
  try {
    const [shows, movies] = await Promise.all([trendingTv(c.env), trendingMovies(c.env)]);
    for (const s of shows.results) urls.push(`${c.env.SITE_URL}/shows/${s.id}-${slugify(s.name ?? "")}`);
    for (const m of movies.results) urls.push(`${c.env.SITE_URL}/movies/${m.id}-${slugify(m.title ?? "")}`);
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

export default app;
