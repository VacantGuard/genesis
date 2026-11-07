import { getDb } from "./db.ts";

export type ZelleAccount = {
  name: string;
  handle: string;
};

function ensureZelleColumns() {
  const db = getDb();
  const names = new Set(
    (db.prepare("PRAGMA table_info(businesses)").all() as { name: string }[]).map((column) => column.name),
  );
  if (!names.has("zelle_name")) db.exec("ALTER TABLE businesses ADD COLUMN zelle_name TEXT NOT NULL DEFAULT ''");
  if (!names.has("zelle_handle")) db.exec("ALTER TABLE businesses ADD COLUMN zelle_handle TEXT NOT NULL DEFAULT ''");
}

function row(businessId: number) {
  ensureZelleColumns();
  return getDb()
    .prepare("SELECT name, zelle_name AS zelleName, zelle_handle AS zelleHandle FROM businesses WHERE id = ?")
    .get(businessId) as { name: string; zelleName: string; zelleHandle: string } | undefined;
}

export function zelleDraft(businessId: number) {
  const current = row(businessId);
  return { name: current?.zelleName.trim() ?? "", handle: current?.zelleHandle.trim() ?? "" };
}

export function zelleAccount(businessId: number): ZelleAccount | null {
  const current = row(businessId);
  if (!current) return null;
  const handle = current.zelleHandle.trim();
  if (!handle) return null;
  return { name: current.zelleName.trim() || current.name, handle };
}

export function saveZelleAccount(businessId: number, input: { name: string; handle: string }) {
  const current = row(businessId);
  if (!current) throw new Error("That business is not on this desk.");
  const handle = input.handle.trim();
  const name = input.name.trim();
  if (!handle) {
    getDb()
      .prepare("UPDATE businesses SET zelle_name = '', zelle_handle = '', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), businessId);
    return;
  }
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(handle);
  const phone = handle.replace(/\D/g, "").length >= 10 && /^[+\d\s().-]+$/.test(handle);
  if (!email && !phone) {
    throw new Error("Zelle needs the email or mobile number enrolled with the bank.");
  }
  if (name && (name.length < 2 || name.length > 80)) {
    throw new Error("The Zelle name needs 2 to 80 characters.");
  }
  if (handle.length > 120) throw new Error("Keep the Zelle email or phone under 120 characters.");
  getDb()
    .prepare("UPDATE businesses SET zelle_name = ?, zelle_handle = ?, updated_at = ? WHERE id = ?")
    .run(name, handle, new Date().toISOString(), businessId);
}
