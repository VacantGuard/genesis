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
