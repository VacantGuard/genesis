import Link from "next/link";
import { TerminalNav } from "@/components/terminal/nav";
import { logoutAction } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { currentBusiness } from "@/lib/current-business";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = { title: "Staff terminal" };

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const business = await currentBusiness();

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Staff</p>
            <p className="font-heading text-xl tracking-tight">{business.name}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{session.username}</span>
            <Link href={`/b/${business.slug}`} className="text-muted-foreground hover:text-foreground">
              Public menu
            </Link>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                Log out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <TerminalNav />
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6">{children}</div>
    </div>
  );
}
