CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  display_name TEXT,
  remind_email INTEGER NOT NULL DEFAULT 0,
  unsub_token TEXT,
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
  notes TEXT,
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
  plays INTEGER NOT NULL DEFAULT 1,
  rating INTEGER,
  UNIQUE(user_id, tmdb_id, season, episode)
);
CREATE INDEX IF NOT EXISTS idx_epw_user_show ON episode_watches(user_id, tmdb_id);

-- movie watch records (one row per watch; rewatches allowed)
CREATE TABLE IF NOT EXISTS movie_watches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  watched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mw_user_movie ON movie_watches(user_id, tmdb_id);

CREATE TABLE IF NOT EXISTS email_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  source TEXT,
  confirmed INTEGER NOT NULL DEFAULT 0,
  confirm_token TEXT,
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

-- public read-only profile share tokens
CREATE TABLE IF NOT EXISTS share_tokens (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- one-time password reset tokens
CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- first-party search-term log (no user id, privacy-preserving)
CREATE TABLE IF NOT EXISTS search_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  q TEXT NOT NULL,
  results INTEGER NOT NULL DEFAULT 0,
  ts TEXT NOT NULL DEFAULT (datetime('now'))
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

-- streaming service preferences (TMDB watch-provider ids)
CREATE TABLE IF NOT EXISTS user_services (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, provider_id)
);

-- custom lists
CREATE TABLE IF NOT EXISTS lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  share_token TEXT
);
CREATE TABLE IF NOT EXISTS list_items (
  list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  title TEXT NOT NULL,
  poster_path TEXT,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (list_id, tmdb_id, media_type)
);
