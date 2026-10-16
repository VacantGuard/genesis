import { cookies } from "next/headers";
import { getBusiness, getHomepageBusiness, type BusinessRecord } from "./businesses.ts";

export async function currentBusiness(): Promise<BusinessRecord> {
  const jar = await cookies();
  const id = Number(jar.get("kitchen_business")?.value);
  if (Number.isInteger(id) && id > 0) {
    const selected = getBusiness(id);
    if (selected) return selected;
  }
  return getHomepageBusiness();
}

export async function rememberBusiness(id: number) {
  const jar = await cookies();
  jar.set("kitchen_business", String(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
