import Link from "next/link";
import type { ReactNode } from "react";

export const publicField =
  "h-10 rounded-lg border border-[#a8c09c]/50 bg-white shadow-none focus-visible:ring-[#a8c09c]";
export const publicButton =
  "h-10 rounded-full bg-[#fc968a] px-5 text-white hover:bg-[#f07d70]";

export function CoralUnderline() {
  return (
    <svg
      viewBox="0 0 320 18"
      className="mx-auto mt-2 block h-4 w-56 text-[#f9a89e]"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M26 11c16-8 32 8 48 0s32-8 48 0 32 8 48 0 32-8 48 0 32 8 48 0 20-6 28 0"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TigEatsMark({ className = "text-[1.7rem]" }: { className?: string }) {
  return <span className={`font-wordmark leading-none text-[#fc968a] ${className}`}>TigEats</span>;
}

export function PublicHeader({
  accountName,
  sectionLinks = false,
  signOut,
}: {
  accountName?: string | null;
  sectionLinks?: boolean;
  signOut?: ReactNode;
}) {
  const section = (id: string) => (sectionLinks ? `#${id}` : `/#${id}`);

  return (
    <header className="sticky top-0 z-30 border-b border-[#a8c09c]/60 bg-[#fdeae3]/95 text-[#496252] backdrop-blur">
      <div className="mx-auto flex h-[4.75rem] max-w-5xl items-center justify-between gap-4 px-5">
        <Link href="/" aria-label="Home" className="inline-flex shrink-0">
          <span className="inline-flex size-14 overflow-hidden rounded-full">
            <img
              src="/tigeats-logo.jpg"
              alt=""
              className="size-full origin-center scale-[1.14] object-cover"
            />
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium sm:gap-6">
          <a href={section("menu")} className="hidden hover:text-[#fc968a] sm:inline">
            Menu
          </a>
          <a href={section("about")} className="hidden hover:text-[#fc968a] sm:inline">
            About
          </a>
          <a href={section("pos")} className="hover:text-[#fc968a]">
            Order
          </a>
          {signOut ?? (
            <Link href={accountName ? "/account" : "/account/login"} className="hover:text-[#fc968a]">
              {accountName ? accountName.split(" ")[0] : "Sign in"}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-[#a8c09c]/50 bg-[#fdeae3]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-xs text-[#5d7568]">
        <TigEatsMark className="text-xl" />
        <span className="flex gap-4">
          <Link href="/privacy" className="hover:text-[#496252]">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-[#496252]">
            Terms and Conditions
          </Link>
          <Link href="/terminal" className="hover:text-[#496252]">
            Staff terminal
          </Link>
        </span>
      </div>
    </footer>
  );
}

export function PublicPage({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#fdeae3] text-[#496252]">{children}</div>;
}
