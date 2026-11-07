import Link from "next/link";
import type { ReactNode } from "react";

export const publicField =
  "h-10 rounded-lg border border-[#a8c09c]/50 bg-white shadow-none focus-visible:ring-[#a8c09c]";
export const publicButton =
  "h-10 rounded-full bg-[#fc968a] px-5 text-white hover:bg-[#f07d70]";

export function CoralUnderline({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 18"
      className={`mx-auto mt-2 block h-4 w-56 text-[#f9a89e] ${className}`}
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
          <span className="relative inline-flex size-14 overflow-hidden rounded-full">
            <img
              src="/tigeats-logo.jpg"
              alt=""
              className="size-full origin-center scale-[1.14] object-cover"
            />
            <svg className="logo-ring" viewBox="0 0 56 56" aria-hidden="true">
              <circle cx="28" cy="28" r="25.5" fill="none" stroke="#a7c0a0" strokeWidth="5" />
              <circle
                cx="28"
                cy="28"
                r="25.5"
                fill="none"
                stroke="#6d8a64"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="34 126"
              />
            </svg>
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium sm:gap-6">
          <a href={section("menu")} className="hidden hover:text-[#fc968a] sm:inline">
            Menu
          </a>
          <a href={section("about")} className="hidden hover:text-[#fc968a] sm:inline">
            About
          </a>
          <a href={section("reviews")} className="hidden hover:text-[#fc968a] sm:inline">
            Reviews
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

const socialProfiles = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/share/19PSy2Vjrw/",
    icon: (
      <svg viewBox="0 0 24 24" className="size-10" aria-hidden="true">
        <path
          fill="#1877F2"
          d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.27h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z"
        />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@tigeatsofficial",
    icon: (
      <svg viewBox="0 0 24 24" className="size-10" aria-hidden="true">
        <path
          fill="#25F4EE"
          d="M14.2 3h2.1a4.8 4.8 0 0 0 3.4 3.3v2.2a7 7 0 0 1-3.4-.9v6.8a5.6 5.6 0 1 1-5.6-5.6c.2 0 .5 0 .7.1v2.3a3.3 3.3 0 1 0 2.3 3.2V3z"
        />
        <path
          fill="#FE2C55"
          d="M15 3.6h2.1a4.8 4.8 0 0 0 3.4 3.3v2.2a7 7 0 0 1-3.4-.9v6.8a5.6 5.6 0 1 1-5.6-5.6c.2 0 .5 0 .7.1v2.3a3.3 3.3 0 1 0 2.3 3.2V3.6z"
        />
        <path
          fill="#111"
          d="M14.6 3.3h2.1a4.8 4.8 0 0 0 3.4 3.3v2.2a7 7 0 0 1-3.4-.9v6.8a5.6 5.6 0 1 1-5.6-5.6c.2 0 .5 0 .7.1v2.3a3.3 3.3 0 1 0 2.3 3.2V3.3z"
        />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/tigeats",
    icon: (
      <svg viewBox="0 0 24 24" className="size-10" aria-hidden="true">
        <defs>
          <radialGradient id="tigeats-instagram" cx="30%" cy="110%" r="120%">
            <stop offset="0%" stopColor="#feda75" />
            <stop offset="25%" stopColor="#fa7e1e" />
            <stop offset="50%" stopColor="#d62976" />
            <stop offset="75%" stopColor="#962fbf" />
            <stop offset="100%" stopColor="#4f5bd5" />
          </radialGradient>
        </defs>
        <rect width="24" height="24" rx="6" fill="url(#tigeats-instagram)" />
        <rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="#fff" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="3.2" fill="none" stroke="#fff" strokeWidth="1.6" />
        <circle cx="16.7" cy="7.3" r="0.9" fill="#fff" />
      </svg>
    ),
  },
] as const;

export function SocialProfiles() {
  return (
    <nav aria-label="Social profiles" className="mt-6 flex items-center justify-center gap-4">
      {socialProfiles.map((profile) => (
        <a
          key={profile.label}
          href={profile.href}
          target="_blank"
          rel="noreferrer"
          aria-label={profile.label}
          className="rounded-full transition-transform hover:scale-105"
        >
          {profile.icon}
        </a>
      ))}
    </nav>
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
      <p className="pb-6 text-center text-xs text-[#5d7568]">
        <a href="https://www.avenixplatform.tech/" target="_blank" rel="noreferrer" className="hover:text-[#496252]">
          Created by Avenix
        </a>
      </p>
    </footer>
  );
}

export function PublicPage({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#fdeae3] text-[#496252]">{children}</div>;
}
