import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isLocalHost(host: string) {
  return host.startsWith("127.0.0.1") || host.startsWith("localhost") || host.startsWith("[::1]");
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (!isLocalHost(host) && request.nextUrl.pathname.startsWith("/terminal")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/terminal/:path*"],
};
