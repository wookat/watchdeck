CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  display_name TEXT,
  remind_email INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- media items a user tracks (tv or movie), keyed by TMDB id
CREATE TABLE IF NOT EXISTS tracked (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('tv','movie')),
  title TEXT NOT NULL,
  poster_path TEXT,
  status TEXT NOT NULL DEFAULT 'watching' CHECK (status IN ('watching','watchlist','completed','dropped')),
  rating INTEGER,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, tmdb_id, media_type)
);
CREATE INDEX IF NOT EXISTS idx_tracked_user ON tracked(user_id);

-- per-episode watch records
CREATE TABLE IF NOT EXISTS episode_watches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  season INTEGER NOT NULL,
  episode INTEGER NOT NULL,
  watched_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, tmdb_id, season, episode)
);
CREATE INDEX IF NOT EXISTS idx_epw_user_show ON episode_watches(user_id, tmdb_id);

-- movie watch records
CREATE TABLE IF NOT EXISTS movie_watches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  watched_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, tmdb_id)
);

CREATE TABLE IF NOT EXISTS email_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- first-party cookieless analytics
CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  path TEXT NOT NULL,
  referrer TEXT,
  country TEXT,
  ua_class TEXT
);
CREATE INDEX IF NOT EXISTS idx_analytics_ts ON analytics_events(ts);

-- per-user iCal feed tokens
CREATE TABLE IF NOT EXISTS feed_tokens (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- import job summaries
CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  shows_imported INTEGER NOT NULL DEFAULT 0,
  episodes_imported INTEGER NOT NULL DEFAULT 0,
  movies_imported INTEGER NOT NULL DEFAULT 0,
  unmatched INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
