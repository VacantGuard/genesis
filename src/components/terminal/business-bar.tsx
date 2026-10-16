import { BusinessSwitcher } from "@/components/terminal/business-switcher";
import { listBusinesses } from "@/lib/businesses";
import { currentBusiness } from "@/lib/current-business";

export async function BusinessBar() {
  const current = await currentBusiness();
  const businesses = listBusinesses().map((business) => ({ id: business.id, name: business.name }));
  return <BusinessSwitcher businesses={businesses} currentId={current.id} />;
}
