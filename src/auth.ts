import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppContext, User } from "./types";

const ITERATIONS = 100_000;

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string, saltHex?: string) {
  const salt = saltHex
    ? Uint8Array.from(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)))
    : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    key,
    256
  );
  return { hash: toHex(bits), salt: toHex(salt.buffer as ArrayBuffer) };
}

export async function verifyPassword(password: string, saltHex: string, expectedHash: string) {
  const { hash } = await hashPassword(password, saltHex);
  return hash === expectedHash;
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
