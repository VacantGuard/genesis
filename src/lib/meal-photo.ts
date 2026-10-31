import { getDb, OrderError } from "./db.ts";
import { sniffPhoto, TEXT_PHOTO_MAX_BYTES } from "./text-media.ts";

export function ensureMealPhotos() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS meal_photos (
      menu_item_id INTEGER PRIMARY KEY,
      content_type TEXT NOT NULL,
      bytes BLOB NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function ownedItem(businessId: number, menuItemId: number) {
  return getDb()
    .prepare(
      `SELECT i.id
       FROM menu_items i
       JOIN menu_categories c ON c.id = i.category_id
       WHERE i.id = ? AND c.business_id = ?`,
    )
    .get(menuItemId, businessId);
}

export function saveMealPhoto(businessId: number, menuItemId: number, bytes: Buffer) {
  if (bytes.length > TEXT_PHOTO_MAX_BYTES) {
    throw new OrderError("That photo is over 4 MB. Use a smaller jpg or png.");
  }
  const contentType = sniffPhoto(bytes);
  if (!contentType) throw new OrderError("Attach a jpg or png.");
  ensureMealPhotos();
  if (!ownedItem(businessId, menuItemId)) return false;
  const updatedAt = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO meal_photos (menu_item_id, content_type, bytes, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(menu_item_id) DO UPDATE SET
         content_type = excluded.content_type,
         bytes = excluded.bytes,
         updated_at = excluded.updated_at`,
    )
    .run(menuItemId, contentType, bytes, updatedAt);
  return true;
}

export function clearMealPhoto(businessId: number, menuItemId: number) {
  ensureMealPhotos();
  if (!ownedItem(businessId, menuItemId)) return false;
  getDb().prepare("DELETE FROM meal_photos WHERE menu_item_id = ?").run(menuItemId);
  return true;
}

export function readMealPhoto(menuItemId: number) {
  ensureMealPhotos();
  const row = getDb()
    .prepare(
      `SELECT content_type AS contentType, bytes
       FROM meal_photos WHERE menu_item_id = ?`,
    )
    .get(menuItemId) as { contentType: string; bytes: unknown } | undefined;
  if (!row) return null;
  const contentType = row.contentType === "image/png" ? "image/png" : row.contentType === "image/jpeg" ? "image/jpeg" : null;
  if (!contentType) return null;
  const bytes = Buffer.isBuffer(row.bytes)
    ? row.bytes
    : row.bytes instanceof Uint8Array
      ? Buffer.from(row.bytes)
      : null;
  if (!bytes || !sniffPhoto(bytes)) return null;
  return { contentType, bytes };
}

export function mealPhotoUrl(menuItemId: number, updatedAt: string | null) {
  if (!updatedAt) return null;
  return `/api/menu-photo/${menuItemId}?v=${encodeURIComponent(updatedAt)}`;
}
