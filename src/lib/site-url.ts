/** Normalize the lasting public site URL staff save on Terminal → Agent. */
export function normalizePublicSiteUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  // Drop path/query/hash — the desk appends /#pos for menu texts.
  return `${parsed.protocol}//${parsed.host}`;
}

export function menuLinkFromPublicSiteUrl(publicSiteUrl: string) {
  const base = normalizePublicSiteUrl(publicSiteUrl);
  if (!base) return "";
  return `${base}/#pos`;
}
