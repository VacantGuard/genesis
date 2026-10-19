import type Database from "libsql";

export const SAMPLE_NAME = "North Bowl";
const SAMPLE_ABOUT = [
  "North Bowl is sample copy for a meal prep kitchen. Rewrite it from the staff terminal when this business is real.",
  "Each week the kitchen cooks a short menu of portioned meals: breakfasts, mains, and sides you can heat through the week. Order and pay on this page. Meals are packed for pickup at the kitchen.",
  "Sample prep day is Sunday, with pickup Monday to Wednesday. Change the name, this story, and the weekly menu whenever the cook cycle changes. Delivery routing is not part of this desk.",
].join("\n\n");

export { SAMPLE_ABOUT };

function insertSampleMenu(db: Database.Database) {
  const category = db.prepare(
    "INSERT INTO menu_categories (name, sort_order) VALUES (?, ?)",
  );
  const item = db.prepare(
    `INSERT INTO menu_items
      (category_id, name, description, price_cents, available, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const breakfasts = Number(category.run("Breakfasts", 1).lastInsertRowid);
  const mains = Number(category.run("Mains", 2).lastInsertRowid);
  const sides = Number(category.run("Sides", 3).lastInsertRowid);

  item.run(
    breakfasts,
    "Egg and potato bake",
    "Two portions. Roasted potato, soft egg, and chili oil.",
    1400,
    1,
    1,
  );
  item.run(
    breakfasts,
    "Brown-butter oat jars",
    "Two jars. Toasted oats, pear, and brown sugar.",
    1200,
    1,
    2,
  );
  item.run(
    mains,
    "Roast chicken and farro",
    "Two portions. Chicken thigh, farro, and charred lemon.",
    2800,
    1,
    1,
  );
  item.run(
    mains,
    "Mushroom rye bowl",
    "Two portions. Seared mushrooms, rye berries, and a herb salad.",
    2400,
    1,
    2,
  );
  item.run(
    mains,
    "Chili-oil lentils",
    "Two portions with yogurt and cabbage. Marked sold out in the sample week.",
    2200,
    0,
    3,
  );
  item.run(sides, "Cucumber cups", "Four cups. Rice vinegar, sesame, and dill.", 1000, 1, 1);
  item.run(sides, "Olive oil cake slices", "Four slices with citrus zest.", 1200, 1, 2);
}

export function seed(db: Database.Database) {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM business_profile").get() as {
    n: number;
  };
  if (existing.n > 0) return;

  const now = new Date().toISOString();
  const insert = db.transaction(() => {
    db.prepare(
      "INSERT INTO business_profile (id, name, about, updated_at) VALUES (1, ?, ?, ?)",
    ).run(SAMPLE_NAME, SAMPLE_ABOUT, now);

    insertSampleMenu(db);

    const companyId = Number(
      db.prepare(
        `INSERT INTO companies (name, contact_name, phone, email, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        "Sample Studio Co.",
        "Front desk",
        "(555) 014-2100",
        "desk@samplestudio.example",
        "Sample office that orders a weekly meal prep run. Edit or replace it.",
        now,
      ).lastInsertRowid,
    );

    const customer = db.prepare(
      `INSERT INTO customers (name, phone, email, company_id, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    customer.run(
      "Avery Cole",
      "(555) 014-2201",
      "avery.cole@example.com",
      companyId,
      "Sample customer who orders prep for the studio.",
      now,
    );
    customer.run(
      "Morgan Ellis",
      "(555) 014-2208",
      "morgan.ellis@example.com",
      null,
      "Sample customer. No onions.",
      now,
    );
    customer.run(
      "Quinn Park",
      "(555) 014-2214",
      "quinn.park@example.com",
      null,
      "Sample customer record.",
      now,
    );
  });

  insert();
}


export function reframeLegacyLunchSample(db: Database.Database) {
  const legacy = db
    .prepare("SELECT id FROM menu_items WHERE name = 'Milk-bread egg sandwich' LIMIT 1")
    .get() as { id: number } | undefined;
  const profile = db
    .prepare("SELECT name, about FROM business_profile WHERE id = 1")
    .get() as { name: string; about: string } | undefined;
  if (!legacy && !profile) return;

  const stillLunchCopy =
    profile?.name === "Weekday Hearth" ||
    profile?.about.includes("sample kitchen copy") ||
    profile?.about.includes("weekday lunch");

  if (!legacy && !stillLunchCopy) return;

  const apply = db.transaction(() => {
    if (legacy) {
      db.prepare("DELETE FROM menu_items").run();
      db.prepare("DELETE FROM menu_categories").run();
      insertSampleMenu(db);
    }
    if (stillLunchCopy) {
      db.prepare(
        "UPDATE business_profile SET name = ?, about = ?, updated_at = ? WHERE id = 1",
      ).run(SAMPLE_NAME, SAMPLE_ABOUT, new Date().toISOString());
    }
    db.prepare(
      `UPDATE companies
       SET notes = ?
       WHERE name = 'Sample Studio Co.' AND notes LIKE '%weekday lunches%'`,
    ).run("Sample office that orders a weekly meal prep run. Edit or replace it.");
    db.prepare(
      `UPDATE customers
       SET notes = ?
       WHERE name = 'Avery Cole' AND notes LIKE '%Sample guest%'`,
    ).run("Sample customer who orders prep for the studio.");
    db.prepare(
      `UPDATE customers SET notes = ? WHERE name = 'Morgan Ellis' AND notes LIKE '%Sample guest%'`,
    ).run("Sample customer. No onions.");
    db.prepare(
      `UPDATE customers SET notes = ? WHERE name = 'Quinn Park' AND notes LIKE '%Sample guest%'`,
    ).run("Sample customer record.");
  });
  apply();
}

