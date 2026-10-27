import { getDb } from "./db.ts";
import type { MenuCategory, MenuItem, PublicCategory } from "./types.ts";

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
         i.sort_order AS sortOrder
       FROM menu_items i
       JOIN menu_categories c ON c.id = i.category_id
       WHERE c.business_id = ?
       ORDER BY c.sort_order, i.sort_order, i.id`,
    )
    .all(businessId)
    .map((row) => {
      const item = row as Omit<MenuItem, "available"> & { available: number };
      return { ...item, available: item.available === 1 };
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

export function createMenuItem(input: {
  businessId: number;
  categoryId: number;
  name: string;
  description: string;
  priceCents: number;
  available: boolean;
}) {
  const db = getDb();
  const category = db
    .prepare("SELECT id FROM menu_categories WHERE id = ? AND business_id = ?")
    .get(input.categoryId, input.businessId);
  if (!category) return false;
  const row = db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) AS n FROM menu_items WHERE category_id = ?")
    .get(input.categoryId) as { n: number };
  db.prepare(
    `INSERT INTO menu_items (category_id, name, description, price_cents, available, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    input.categoryId,
    input.name,
    input.description,
    input.priceCents,
    input.available ? 1 : 0,
    row.n + 1,
  );
  return true;
}

export function updateMenuItem(input: {
  businessId: number;
  id: number;
  categoryId: number;
  name: string;
  description: string;
  priceCents: number;
  available: boolean;
}) {
  const db = getDb();
  const category = db
    .prepare("SELECT id FROM menu_categories WHERE id = ? AND business_id = ?")
    .get(input.categoryId, input.businessId);
  if (!category) return false;
  const result = db
    .prepare(
      `UPDATE menu_items
       SET category_id = ?, name = ?, description = ?, price_cents = ?, available = ?
       WHERE id = ?
         AND category_id IN (SELECT id FROM menu_categories WHERE business_id = ?)`,
    )
    .run(
      input.categoryId,
      input.name,
      input.description,
      input.priceCents,
      input.available ? 1 : 0,
      input.id,
      input.businessId,
    );
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
  const result = getDb()
    .prepare(
      `DELETE FROM menu_items
       WHERE id = ?
         AND category_id IN (SELECT id FROM menu_categories WHERE business_id = ?)`,
    )
    .run(id, businessId);
  return result.changes > 0;
}

export function findMenuItemByName(businessId: number, name: string) {
  return listMenuItems(businessId).find((item) => item.name.toLowerCase() === name.toLowerCase()) ?? null;
}
