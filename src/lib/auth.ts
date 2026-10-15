import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "kitchen-local";
const SESSION_SECRET =
  process.env.SESSION_SECRET || "kitchen-local-session-secret";
const COOKIE = "kitchen_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = {
  username: string;
  exp: number;
};

function sameSecret(left: string, right: string) {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

export function credentialsMatch(username: string, password: string) {
  return sameSecret(username, ADMIN_USERNAME) && sameSecret(password, ADMIN_PASSWORD);
}

export function signSession(username: string) {
  const payload: SessionPayload = {
    username,
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

export function readSession(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", SESSION_SECRET)
    .update(body)
    .digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (!payload.username || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSession() {
  const jar = await cookies();
  return readSession(jar.get(COOKIE)?.value);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/terminal/login");
  return session;
}

export async function setSessionCookie(username: string) {
  const jar = await cookies();
  jar.set(COOKIE, signSession(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
