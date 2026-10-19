import { getDb } from "./db.ts";
import { SAMPLE_ABOUT, SAMPLE_NAME } from "./seed.ts";

export type BusinessRecord = {
  id: number;
  slug: string;
  name: string;
  about: string;
  isHomepage: boolean;
  isSample: boolean;
  slackTeamId: string | null;
  slackTeamName: string;
};

type BusinessRow = Omit<BusinessRecord, "isHomepage" | "isSample"> & {
  isHomepage: number;
  isSample: number;
};

function mapBusiness(row: BusinessRow): BusinessRecord {
  return {
    ...row,
    isHomepage: row.isHomepage === 1,
    isSample: row.isSample === 1,
  };
}

export function slugify(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || "business";
}

function addColumn(table: string, column: string, definition: string) {
  const db = getDb();
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (columns.some((entry) => entry.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function initTenancy() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      about TEXT NOT NULL,
      is_homepage INTEGER NOT NULL DEFAULT 0,
      is_sample INTEGER NOT NULL DEFAULT 0,
      slack_team_id TEXT UNIQUE,
      slack_team_name TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
  `);
  addColumn("menu_categories", "business_id", "INTEGER");
  addColumn("companies", "business_id", "INTEGER");
  addColumn("customers", "business_id", "INTEGER");
  addColumn("orders", "business_id", "INTEGER");
  addColumn("campaigns", "business_id", "INTEGER");

  const count = db.prepare("SELECT COUNT(*) AS n FROM businesses").get() as { n: number };
  if (count.n === 0) {
    const profile = db
      .prepare("SELECT name, about, updated_at AS updatedAt FROM business_profile WHERE id = 1")
      .get() as { name: string; about: string; updatedAt: string } | undefined;
    if (profile) {
      const slug = uniqueSlug(db, slugify(profile.name));
      db.prepare(
        `INSERT INTO businesses (slug, name, about, is_homepage, is_sample, updated_at)
         VALUES (?, ?, ?, 1, 1, ?)`,
      ).run(slug, profile.name, profile.about, profile.updatedAt);
    }
  }

  const home = db.prepare("SELECT id FROM businesses WHERE is_homepage = 1 LIMIT 1").get() as
    | { id: number }
    | undefined;
  const fallback = home ?? (db.prepare("SELECT id FROM businesses ORDER BY id LIMIT 1").get() as { id: number } | undefined);
  if (!fallback) return;
  for (const table of ["menu_categories", "companies", "customers", "orders", "campaigns"]) {
    db.prepare(`UPDATE ${table} SET business_id = ? WHERE business_id IS NULL`).run(fallback.id);
  }
}

export function keepSampleAsNorthBowl(db: ReturnType<typeof getDb>) {
  const extras = db
    .prepare(
      `SELECT id FROM businesses
       WHERE is_homepage = 0
         AND (SELECT COUNT(*) FROM menu_categories WHERE business_id = businesses.id) = 0
         AND (SELECT COUNT(*) FROM customers WHERE business_id = businesses.id) = 0
         AND (SELECT COUNT(*) FROM companies WHERE business_id = businesses.id) = 0
         AND (SELECT COUNT(*) FROM orders WHERE business_id = businesses.id) = 0`,
    )
    .all() as { id: number }[];
  for (const extra of extras) {
    db.prepare("DELETE FROM campaigns WHERE business_id = ?").run(extra.id);
    db.prepare("DELETE FROM businesses WHERE id = ?").run(extra.id);
  }

  const home = db
    .prepare("SELECT id, name, about FROM businesses WHERE is_homepage = 1 LIMIT 1")
    .get() as { id: number; name: string; about: string } | undefined;
  if (!home || (home.name !== "Hearth Prep" && !home.about.startsWith("Hearth Prep is sample copy"))) return;

  const now = new Date().toISOString();
  db.prepare("UPDATE businesses SET name = ?, slug = ?, about = ?, updated_at = ? WHERE id = ?").run(
    SAMPLE_NAME,
    uniqueSlug(db, "north-bowl", home.id),
    SAMPLE_ABOUT,
    now,
    home.id,
  );
  db.prepare(
    "UPDATE business_profile SET name = ?, about = ?, updated_at = ? WHERE id = 1 AND (name = 'Hearth Prep' OR about LIKE 'Hearth Prep is sample copy%')",
  ).run(SAMPLE_NAME, SAMPLE_ABOUT, now);
}

function uniqueSlug(db: ReturnType<typeof getDb>, base: string, exceptId?: number) {
  let slug = base;
  let n = 2;
  while (true) {
    const row = db.prepare("SELECT id FROM businesses WHERE slug = ?").get(slug) as { id: number } | undefined;
    if (!row || row.id === exceptId) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

const selectBusiness = `
  SELECT id, slug, name, about,
         is_homepage AS isHomepage,
         is_sample AS isSample,
         slack_team_id AS slackTeamId,
         slack_team_name AS slackTeamName
  FROM businesses
`;

export function getBusiness(id: number): BusinessRecord | null {
  const row = getDb().prepare(`${selectBusiness} WHERE id = ?`).get(id) as BusinessRow | undefined;
  return row ? mapBusiness(row) : null;
}

export function getBusinessBySlug(slug: string): BusinessRecord | null {
  const row = getDb().prepare(`${selectBusiness} WHERE slug = ?`).get(slug) as BusinessRow | undefined;
  return row ? mapBusiness(row) : null;
}

export function getBusinessBySlackTeam(teamId: string): BusinessRecord | null {
  const row = getDb().prepare(`${selectBusiness} WHERE slack_team_id = ?`).get(teamId) as BusinessRow | undefined;
  return row ? mapBusiness(row) : null;
}

export function getHomepageBusiness(): BusinessRecord {
  const row = getDb().prepare(`${selectBusiness} WHERE is_homepage = 1 LIMIT 1`).get() as BusinessRow | undefined;
  if (row) return mapBusiness(row);
  const any = getDb().prepare(`${selectBusiness} ORDER BY id LIMIT 1`).get() as BusinessRow | undefined;
  if (!any) throw new Error("No business is configured.");
  return mapBusiness(any);
}

export function updateBusinessProfile(id: number, name: string, about: string) {
  getDb()
    .prepare("UPDATE businesses SET name = ?, about = ?, updated_at = ? WHERE id = ?")
    .run(name, about, new Date().toISOString(), id);
}

export function setSlackConnection(id: number, teamId: string | null, teamName: string) {
  const db = getDb();
  if (teamId) {
    const taken = db
      .prepare("SELECT id FROM businesses WHERE slack_team_id = ? AND id != ?")
      .get(teamId, id) as { id: number } | undefined;
    if (taken) throw new Error("That Slack workspace is already connected to another business.");
  }
  db.prepare(
    "UPDATE businesses SET slack_team_id = ?, slack_team_name = ?, updated_at = ? WHERE id = ?",
  ).run(teamId, teamName, new Date().toISOString(), id);
}

function ensurePublicOriginColumn() {
  const db = getDb();
  const names = new Set(
    (db.prepare("PRAGMA table_info(businesses)").all() as { name: string }[]).map((column) => column.name),
  );
  if (!names.has("public_origin")) {
    db.exec("ALTER TABLE businesses ADD COLUMN public_origin TEXT NOT NULL DEFAULT ''");
  }
}

export function rememberPublicOrigin(businessId: number, origin: string | undefined) {
  if (!origin?.startsWith("https://")) return;
  let host = "";
  try {
    host = new URL(origin).host;
  } catch {
    return;
  }
  if (!host || host.startsWith("localhost") || host.endsWith(".local")) return;
  ensurePublicOriginColumn();
  getDb().prepare("UPDATE businesses SET public_origin = ? WHERE id = ?").run(origin.replace(/\/$/, ""), businessId);
}

export function rememberedOrigin(businessId: number) {
  ensurePublicOriginColumn();
  const row = getDb().prepare("SELECT public_origin AS origin FROM businesses WHERE id = ?").get(businessId) as
    | { origin: string }
    | undefined;
  return row?.origin || process.env.PUBLIC_BASE_URL || "";
}

export function menuLink(slug: string, origin?: string) {
  const base = (origin || process.env.PUBLIC_BASE_URL || "http://127.0.0.1:43123").replace(/\/$/, "");
  return `${base}/b/${slug}#pos`;
}
