import { getDb } from "./db.ts";

export type PublicReview = {
  id: number;
  author: string;
  rating: number;
  body: string;
  createdAt: string;
};

function ensureReviews() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      author TEXT NOT NULL,
      rating INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

export function listReviews(businessId: number): PublicReview[] {
  ensureReviews();
  return getDb()
    .prepare(
      `SELECT id, author, rating, body, created_at AS createdAt
       FROM reviews
       WHERE business_id = ?
       ORDER BY id DESC
       LIMIT 30`,
    )
    .all(businessId) as PublicReview[];
}

export function addReview(input: { businessId: number; author: string; rating: number; body: string }) {
  const author = input.author.trim();
  const body = input.body.trim();
  if (author.length < 2 || author.length > 40) {
    return { ok: false as const, error: "Use a name of 2 to 40 characters." };
  }
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return { ok: false as const, error: "Choose a rating from 1 to 5." };
  }
  if (body.length < 4 || body.length > 500) {
    return { ok: false as const, error: "Write a review of 4 to 500 characters." };
  }
  ensureReviews();
  const createdAt = new Date().toISOString();
  const result = getDb()
    .prepare(
      `INSERT INTO reviews (business_id, author, rating, body, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(input.businessId, author, input.rating, body, createdAt);
  const review: PublicReview = {
    id: Number(result.lastInsertRowid),
    author,
    rating: input.rating,
    body,
    createdAt,
  };
  return { ok: true as const, review };
}
