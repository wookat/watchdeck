export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  ASSETS: Fetcher;
  SITE_URL: string;
  PAYWALL_ENABLED: string;
  ADMIN_EMAIL?: string;
  TMDB_READ_TOKEN: string;
  INDEXNOW_KEY?: string;
}

export interface User {
  id: number;
  email: string;
  display_name: string | null;
}

export type AppContext = {
  Bindings: Env;
  Variables: { user: User | null };
};
