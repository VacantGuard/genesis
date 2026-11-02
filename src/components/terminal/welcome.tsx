import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const starts = [
  {
    title: "Menu",
    href: "/terminal/menu",
    text: "Put this week’s meals up on Friday morning. Saving a meal can text the customers already on the list.",
  },
  {
    title: "Orders",
    href: "/terminal/orders",
    text: "Monday delivery closes Sunday at noon. Thursday delivery closes Wednesday at noon. Both times are Chicago time. Card orders are already paid. A Zelle order waits until you mark the transfer received.",
  },
  {
    title: "Texts",
    href: "/terminal/campaigns",
    text: "The weekly menu text uses the day and time saved on that page.",
  },
  {
    title: "Customers",
    href: "/terminal/customers",
    text: "Names and numbers for the people you cook for. A checkout with a delivery address adds them here.",
  },
];

export function StaffWelcome({ name, menuHref }: { name: string; menuHref: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl tracking-tight">Welcome to {name}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="max-w-2xl leading-6 text-muted-foreground">
          This is your desk. Customers order on the public menu. You keep the week moving from here:
          the meals, the orders, and the texts.
        </p>
        <ul className="grid gap-3">
          {starts.map((item) => (
            <li key={item.title}>
              <Link href={item.href} className="font-medium hover:underline">
                {item.title}
              </Link>
              <p className="mt-1 leading-6 text-muted-foreground">{item.text}</p>
            </li>
          ))}
        </ul>
        <p className="max-w-2xl leading-6 text-muted-foreground">
          Sign in next time with the username you just created. If you lose that password, ask for a
          new invite link. The public menu is open whenever you want to see what customers see.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/terminal/menu" className={buttonVariants()}>
            Open the menu
          </Link>
          <Link href={menuHref} className={buttonVariants({ variant: "outline" })}>
            See the public menu
          </Link>
          <Link href="/terminal" className={buttonVariants({ variant: "outline" })}>
            Continue to the desk
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
