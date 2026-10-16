import { getDb } from "./db.ts";

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
      const slug = uniqueSlug(slugify(profile.name));
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

function uniqueSlug(base: string, exceptId?: number) {
  const db = getDb();
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

export function listBusinesses(): BusinessRecord[] {
  return (getDb().prepare(`${selectBusiness} ORDER BY name COLLATE NOCASE`).all() as BusinessRow[]).map(mapBusiness);
}

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

export function createBusiness(name: string, about: string) {
  const db = getDb();
  const slug = uniqueSlug(slugify(name));
  const homepage = db.prepare("SELECT COUNT(*) AS n FROM businesses WHERE is_homepage = 1").get() as { n: number };
  const result = db
    .prepare(
      `INSERT INTO businesses (slug, name, about, is_homepage, is_sample, updated_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
    )
    .run(slug, name, about, homepage.n === 0 ? 1 : 0, new Date().toISOString());
  return getBusiness(Number(result.lastInsertRowid))!;
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

export function menuLink(slug: string, origin?: string) {
  const base = (origin || process.env.PUBLIC_BASE_URL || "http://127.0.0.1:43123").replace(/\/$/, "");
  return `${base}/b/${slug}#pos`;
}
