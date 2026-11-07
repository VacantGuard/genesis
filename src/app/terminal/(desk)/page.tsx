import { StaffWelcome } from "@/components/terminal/welcome";
import { currentBusiness } from "@/lib/current-business";
import { formatMoney, formatWhen } from "@/lib/format";
import { getDashboardStats, listOrders } from "@/lib/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TerminalHomePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const query = await searchParams;
  const business = await currentBusiness();
  const stats = getDashboardStats(business.id);
  const recent = listOrders(business.id).slice(0, 5);

  const tiles = [
    { label: "Paid orders", value: String(stats.orderCount) },
    { label: "Today", value: String(stats.todayOrderCount) },
    { label: "Recorded sales", value: formatMoney(stats.salesCents) },
    { label: "On the menu", value: String(stats.availableItemCount) },
    { label: "Customers", value: String(stats.customerCount) },
    { label: "Companies", value: String(stats.companyCount) },
    { label: "Text campaigns", value: String(stats.campaignCount) },
  ];

  return (
    <>
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Overview</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Update the weekly menu, read orders, and send menu texts. Customers order on the public
          site and choose Monday or Thursday delivery.
        </p>
      </div>
      {query.welcome === "1" ? (
        <StaffWelcome name={business.name} menuHref={`/b/${business.slug}`} />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} size="sm">
            <CardHeader>
              <CardTitle className="text-muted-foreground">{tile.label}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-medium tracking-tight">{tile.value}</CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Latest paid orders</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No paid orders yet. An order appears here after checkout on the public page.
            </p>
          ) : (
            <ul className="grid gap-3">
              {recent.map((order) => (
                <li key={order.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{order.orderNumber}</span>
                  <span>{order.customerName}</span>
                  <span className="text-muted-foreground">{formatWhen(order.createdAt)}</span>
                  <span>{formatMoney(order.totalCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
