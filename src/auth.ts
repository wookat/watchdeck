import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppContext, User } from "./types";

// Cloudflare Workers caps PBKDF2 at 100k iterations (NotSupportedError above);
// keep the self-describing "<iterations>$<hex>" format so the cost can rise if the cap does.
const ITERATIONS = 100_000;
const LEGACY_ITERATIONS = 100_000;

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function deriveHex(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return toHex(bits);
}

// Stored hash format: "<iterations>$<hex>"; bare hex is a legacy 100k-iteration hash.
export async function hashPassword(password: string, saltHex?: string) {
  const salt = saltHex
    ? Uint8Array.from(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)))
    : crypto.getRandomValues(new Uint8Array(16));
  const hex = await deriveHex(password, salt, ITERATIONS);
  return { hash: `${ITERATIONS}$${hex}`, salt: toHex(salt.buffer as ArrayBuffer) };
}

export function needsRehash(storedHash: string): boolean {
  return !storedHash.startsWith(`${ITERATIONS}$`);
}

export async function verifyPassword(password: string, saltHex: string, storedHash: string) {
  const sep = storedHash.indexOf("$");
  const iterations = sep > 0 ? parseInt(storedHash.slice(0, sep), 10) : LEGACY_ITERATIONS;
  const expected = sep > 0 ? storedHash.slice(sep + 1) : storedHash;
  const salt = Uint8Array.from(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const hex = await deriveHex(password, salt, iterations);
  return hex === expected;
}

export function newToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer);
}

export async function createSession(c: Context<AppContext>, userId: number) {
  const token = newToken();
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  await c.env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(token, userId, expires.toISOString())
    .run();
  setCookie(c, "wd_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    expires,
  });
}

export async function destroySession(c: Context<AppContext>) {
  const token = getCookie(c, "wd_session");
  if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  deleteCookie(c, "wd_session", { path: "/" });
}

export async function loadUser(c: Context<AppContext>): Promise<User | null> {
  const token = getCookie(c, "wd_session");
  if (!token) return null;
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.display_name, u.remind_email FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > datetime('now')`
  )
    .bind(token)
    .first<User>();
  return row ?? null;
}
