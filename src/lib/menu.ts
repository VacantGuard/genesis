import { getDb } from "./db.ts";
import { clearMealPhoto, ensureMealPhotos, mealPhotoUrl } from "./meal-photo.ts";
import type { MenuCategory, MenuItem, PublicCategory } from "./types.ts";

function ensureNutritionColumns() {
  const db = getDb();
  const names = new Set(
    (db.prepare("PRAGMA table_info(menu_items)").all() as { name: string }[]).map((column) => column.name),
  );
  if (!names.has("calories")) db.exec("ALTER TABLE menu_items ADD COLUMN calories INTEGER");
  if (!names.has("protein")) db.exec("ALTER TABLE menu_items ADD COLUMN protein INTEGER");
}

function asCount(value: number | string | null | undefined) {
  if (value == null || value === "") return null;
  const count = Number(value);
  return Number.isFinite(count) ? count : null;
}

export function listCategories(businessId: number): MenuCategory[] {
  return getDb()
    .prepare(
      `SELECT id, name, sort_order AS sortOrder
       FROM menu_categories
       WHERE business_id = ?
       ORDER BY sort_order, id`,
    )
    .all(businessId) as MenuCategory[];
}

export function listMenuItems(businessId: number): MenuItem[] {
  ensureNutritionColumns();
  ensureMealPhotos();
  return getDb()
    .prepare(
      `SELECT
         i.id,
         i.category_id AS categoryId,
         c.name AS categoryName,
         i.name,
         i.description,
         i.price_cents AS priceCents,
         i.available AS available,
         i.sort_order AS sortOrder,
         i.calories AS calories,
         i.protein AS protein,
         (SELECT updated_at FROM meal_photos WHERE menu_item_id = i.id) AS photoUpdatedAt
       FROM menu_items i
       JOIN menu_categories c ON c.id = i.category_id
       WHERE c.business_id = ?
       ORDER BY c.sort_order, i.sort_order, i.id`,
    )
    .all(businessId)
    .map((row) => {
      const item = row as Omit<MenuItem, "available" | "calories" | "protein" | "photoUpdatedAt"> & {
        available: number;
        calories: number | string | null;
        protein: number | string | null;
        photoUpdatedAt: string | null;
      };
      return {
        ...item,
        available: item.available === 1,
        calories: asCount(item.calories),
        protein: asCount(item.protein),
        photoUpdatedAt: item.photoUpdatedAt || null,
      };
    });
}

export function getPublicMenu(businessId: number): PublicCategory[] {
  const categories = listCategories(businessId);
  const items = listMenuItems(businessId);
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    items: items
      .filter((item) => item.categoryId === category.id)
      .map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        priceCents: item.priceCents,
        available: item.available,
        calories: item.calories,
        protein: item.protein,
        photoUrl: mealPhotoUrl(item.id, item.photoUpdatedAt),
      })),
  }));
}

export function createCategory(businessId: number, name: string) {
  const db = getDb();
  const row = db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) AS n FROM menu_categories WHERE business_id = ?")
    .get(businessId) as { n: number };
  db.prepare("INSERT INTO menu_categories (name, sort_order, business_id) VALUES (?, ?, ?)").run(
    name,
    row.n + 1,
    businessId,
  );
}

export function renameCategory(businessId: number, id: number, name: string) {
  getDb()
    .prepare("UPDATE menu_categories SET name = ? WHERE id = ? AND business_id = ?")
    .run(name, id, businessId);
}

export function deleteCategory(businessId: number, id: number) {
  getDb().prepare("DELETE FROM menu_categories WHERE id = ? AND business_id = ?").run(id, businessId);
}

function shelfCategoryId(businessId: number) {
  const existing = listCategories(businessId)[0];
  if (existing) return existing.id;
  createCategory(businessId, "Menu");
  return listCategories(businessId)[0]?.id ?? null;
}

export function createMenuItem(input: {
  businessId: number;
  categoryId?: number | null;
  name: string;
  description: string;
  priceCents: number;
  available: boolean;
  calories?: number | null;
  protein?: number | null;
}) {
  const db = getDb();
  ensureNutritionColumns();
  const categoryId = input.categoryId ?? shelfCategoryId(input.businessId);
  if (!categoryId) return false;
  const category = db
    .prepare("SELECT id FROM menu_categories WHERE id = ? AND business_id = ?")
    .get(categoryId, input.businessId);
  if (!category) return false;
  const row = db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) AS n FROM menu_items WHERE category_id = ?")
    .get(categoryId) as { n: number };
  const inserted = db
    .prepare(
      `INSERT INTO menu_items (category_id, name, description, price_cents, available, sort_order, calories, protein)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      categoryId,
      input.name,
      input.description,
      input.priceCents,
      input.available ? 1 : 0,
      row.n + 1,
      input.calories ?? null,
      input.protein ?? null,
    );
  return Number(inserted.lastInsertRowid);
}

export function updateMenuItem(input: {
  businessId: number;
  id: number;
  categoryId?: number | null;
  name: string;
  description: string;
  priceCents: number;
  available: boolean;
  calories?: number | null;
  protein?: number | null;
}) {
  const db = getDb();
  ensureNutritionColumns();
  const assignments = ["name = ?", "description = ?", "price_cents = ?", "available = ?"];
  const values: Array<string | number | null> = [
    input.name,
    input.description,
    input.priceCents,
    input.available ? 1 : 0,
  ];
  if (input.categoryId) {
    const category = db
      .prepare("SELECT id FROM menu_categories WHERE id = ? AND business_id = ?")
      .get(input.categoryId, input.businessId);
    if (!category) return false;
    assignments.unshift("category_id = ?");
    values.unshift(input.categoryId);
  }
  if (input.calories !== undefined) {
    assignments.push("calories = ?");
    values.push(input.calories);
  }
  if (input.protein !== undefined) {
    assignments.push("protein = ?");
    values.push(input.protein);
  }
  const result = db
    .prepare(
      `UPDATE menu_items
       SET ${assignments.join(", ")}
       WHERE id = ?
         AND category_id IN (SELECT id FROM menu_categories WHERE business_id = ?)`,
    )
    .run(...values, input.id, input.businessId);
  if (result.changes > 0) return true;
  const row = db
    .prepare(
      `SELECT id FROM menu_items
       WHERE id = ?
         AND category_id IN (SELECT id FROM menu_categories WHERE business_id = ?)`,
    )
    .get(input.id, input.businessId);
  return Boolean(row);
}

export function setMenuItemAvailability(businessId: number, id: number, available: boolean) {
  const result = getDb()
    .prepare(
      `UPDATE menu_items
       SET available = ?
       WHERE id = ?
         AND category_id IN (SELECT id FROM menu_categories WHERE business_id = ?)`,
    )
    .run(available ? 1 : 0, id, businessId);
  return result.changes > 0;
}

export function deleteMenuItem(businessId: number, id: number) {
  const db = getDb();
  const owned = db
    .prepare(
      `SELECT i.id
       FROM menu_items i
       JOIN menu_categories c ON c.id = i.category_id
       WHERE i.id = ? AND c.business_id = ?`,
    )
    .get(id, businessId);
  if (!owned) return false;
  clearMealPhoto(businessId, id);
  db.prepare(
    `DELETE FROM menu_items
     WHERE id = ?
       AND category_id IN (SELECT id FROM menu_categories WHERE business_id = ?)`,
  ).run(id, businessId);
  return true;
}

export function findMenuItemByName(businessId: number, name: string) {
  return listMenuItems(businessId).find((item) => item.name.toLowerCase() === name.toLowerCase()) ?? null;
}
