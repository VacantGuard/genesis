import { randomBytes } from "node:crypto";
import { getDb, OrderError } from "./db.ts";

export const TEXT_PHOTO_MAX_BYTES = 4 * 1024 * 1024;

export type TextPhotoRecord = {
  token: string;
  filename: string;
  contentType: "image/jpeg" | "image/png";
};

type TextPhotoFile = TextPhotoRecord & { bytes: Buffer };

function ensureTextMediaTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS text_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      bytes BLOB NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

function syncReplica() {
  const db = getDb() as { sync?: () => void };
  if (typeof db.sync !== "function") return;
  try {
    db.sync();
  } catch {
    // A local sqlite file has no remote replica to sync.
  }
}

export function sniffPhoto(bytes: Buffer): "image/jpeg" | "image/png" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length < 8) return null;
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, index) => bytes[index] === byte)) return "image/png";
  return null;
}

function displayName(name: string, contentType: "image/jpeg" | "image/png") {
  const ext = contentType === "image/png" ? "png" : "jpg";
  const base = name.split(/[/\\]/).pop() || "";
  const cleaned = base.replace(/[^\w.\- ()]+/g, "").trim().slice(0, 80);
  if (!cleaned) return `photo.${ext}`;
  return cleaned;
}

function asBuffer(value: unknown) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return null;
}

export function saveTextPhoto(businessId: number, input: { name: string; bytes: Buffer }): TextPhotoRecord {
  if (input.bytes.length > TEXT_PHOTO_MAX_BYTES) {
    throw new OrderError("That photo is over 4 MB. Use a smaller jpg or png.");
  }
  const contentType = sniffPhoto(input.bytes);
  if (!contentType) throw new OrderError("Attach a jpg or png.");
  ensureTextMediaTable();
  const token = randomBytes(16).toString("hex");
  const filename = displayName(input.name, contentType);
  getDb()
    .prepare(
      `INSERT INTO text_media (business_id, token, filename, content_type, bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(businessId, token, filename, contentType, input.bytes, new Date().toISOString());
  return { token, filename, contentType };
}

export function findTextPhoto(businessId: number, token: string): TextPhotoRecord | null {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  ensureTextMediaTable();
  syncReplica();
  const row = getDb()
    .prepare(
      `SELECT token, filename, content_type AS contentType
       FROM text_media WHERE token = ? AND business_id = ?`,
    )
    .get(token, businessId) as { token: string; filename: string; contentType: string } | undefined;
  if (!row || (row.contentType !== "image/jpeg" && row.contentType !== "image/png")) return null;
  return { token: row.token, filename: row.filename, contentType: row.contentType };
}

export function readTextPhoto(token: string, ext: "jpg" | "png"): TextPhotoFile | null {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  ensureTextMediaTable();
  syncReplica();
  const row = getDb()
    .prepare(
      `SELECT token, filename, content_type AS contentType, bytes
       FROM text_media WHERE token = ?`,
    )
    .get(token) as { token: string; filename: string; contentType: string; bytes: unknown } | undefined;
  if (!row) return null;
  const contentType = row.contentType === "image/png" ? "image/png" : row.contentType === "image/jpeg" ? "image/jpeg" : null;
  if (!contentType) return null;
  const expected = contentType === "image/png" ? "png" : "jpg";
  if (ext !== expected) return null;
  const bytes = asBuffer(row.bytes);
  if (!bytes || !sniffPhoto(bytes)) return null;
  return { token: row.token, filename: row.filename, contentType, bytes };
}

export function textPhotoPublicUrl(origin: string, photo: TextPhotoRecord) {
  let base: URL;
  try {
    base = new URL(origin);
  } catch {
    return "";
  }
  if (base.protocol !== "http:" && base.protocol !== "https:") return "";
  if (base.hostname === "tigeats.com") base.hostname = "www.tigeats.com";
  const ext = photo.contentType === "image/png" ? "png" : "jpg";
  return `${base.origin}/api/text-media/${photo.token}.${ext}`;
}
