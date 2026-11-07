import { randomBytes } from "node:crypto";
import { checkPassword, hashPassword } from "./customer-auth";
import { getDb } from "./db";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function ensureStaffSchema() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS staff_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS staff_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT NOT NULL DEFAULT '',
      username TEXT NOT NULL DEFAULT ''
    );
  `);
}

export function staffPasswordMatches(username: string, password: string) {
  ensureStaffSchema();
  const row = getDb()
    .prepare("SELECT password_hash AS passwordHash FROM staff_accounts WHERE username = ?")
    .get(username.trim().toLowerCase()) as { passwordHash: string } | undefined;
  if (!row) return false;
  return checkPassword(password, row.passwordHash);
}

export function createStaffInvite() {
  ensureStaffSchema();
  const token = randomBytes(24).toString("base64url");
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + WEEK_MS).toISOString();
  getDb()
    .prepare("INSERT INTO staff_invites (token, created_at, expires_at) VALUES (?, ?, ?)")
    .run(token, createdAt, expiresAt);
  return { token, expiresAt };
}

export function listStaffAccounts() {
  ensureStaffSchema();
  return getDb()
    .prepare("SELECT username, created_at AS createdAt FROM staff_accounts ORDER BY id")
    .all() as { username: string; createdAt: string }[];
}

export function listOpenInvites() {
  ensureStaffSchema();
  return getDb()
    .prepare(
      `SELECT token, expires_at AS expiresAt FROM staff_invites
       WHERE used_at = '' AND expires_at > ? ORDER BY id DESC`,
    )
    .all(new Date().toISOString()) as { token: string; expiresAt: string }[];
}

function usernameOk(username: string) {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(username);
}

export function claimStaffInvite(input: {
  token: string;
  username: string;
  password: string;
  confirm: string;
}) {
  ensureStaffSchema();
  const username = input.username.trim().toLowerCase();
  if (!usernameOk(username)) {
    throw new Error("Use 3 to 32 letters or numbers. Dots, hyphens, and underscores are allowed.");
  }
  const reserved = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
  if (username === reserved) {
    throw new Error("That username is the original kitchen login. Choose another.");
  }
  if (input.password.length < 8 || input.password.length > 72) {
    throw new Error("Use a password between 8 and 72 characters.");
  }
  if (input.password !== input.confirm) throw new Error("Those passwords do not match.");

  const db = getDb();
  const invite = db
    .prepare("SELECT id, expires_at AS expiresAt, used_at AS usedAt FROM staff_invites WHERE token = ?")
    .get(input.token) as { id: number; expiresAt: string; usedAt: string } | undefined;
  if (!invite) throw new Error("That invite link is not valid.");
  if (invite.usedAt) {
    throw new Error("That invite link has already been used. Sign in with the username that was created.");
  }
  if (invite.expiresAt < new Date().toISOString()) {
    throw new Error("That invite link has expired. Ask for a new one.");
  }
  const taken = db.prepare("SELECT id FROM staff_accounts WHERE username = ?").get(username);
  if (taken) throw new Error("That username is already in use.");

  const now = new Date().toISOString();
  const hash = hashPassword(input.password);
  db.transaction(() => {
    db.prepare("INSERT INTO staff_accounts (username, password_hash, created_at) VALUES (?, ?, ?)").run(
      username,
      hash,
      now,
    );
    const claimed = db
      .prepare("UPDATE staff_invites SET used_at = ?, username = ? WHERE id = ? AND used_at = ''")
      .run(now, username, invite.id);
    if (claimed.changes !== 1) throw new Error("That invite link has already been used.");
  })();
  return username;
}
