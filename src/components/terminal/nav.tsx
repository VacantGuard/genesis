"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const links = [
  { href: "/terminal", label: "Overview" },
  { href: "/terminal/menu", label: "Menu" },
  { href: "/terminal/customers", label: "Customers" },
  { href: "/terminal/companies", label: "Companies" },
  { href: "/terminal/campaigns", label: "Texts" },
  { href: "/terminal/orders", label: "Orders" },
  { href: "/terminal/profile", label: "Business" },
  { href: "/terminal/agent", label: "Agent" },
  { href: "/terminal/slack", label: "Slack" },
];

export function TerminalNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b bg-card px-3">
      {links.map((link) => {
        const active =
          link.href === "/terminal"
            ? pathname === "/terminal"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 border-b-2 px-3 py-3 text-sm font-medium",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
