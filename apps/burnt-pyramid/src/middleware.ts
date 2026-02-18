import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware for burnt-pyramid:
 * 1. Admin page gate — blocks /admin/* in production unless ADMIN_PAGE_SECRET matches
 * 2. CSRF origin check — blocks cross-origin state-changing requests to /api/* (except webhooks)
 */
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // --- Admin page gate (M7) ---
    if (pathname.startsWith("/admin")) {
        const secret = process.env.ADMIN_PAGE_SECRET;
        if (secret) {
            const cookieVal = request.cookies.get("admin_secret")?.value;
            const queryVal = request.nextUrl.searchParams.get("secret");

            if (cookieVal !== secret && queryVal !== secret) {
                return NextResponse.redirect(new URL("/", request.url));
            }

            // If authenticated via query param, set cookie and redirect to clean URL
            if (queryVal === secret && cookieVal !== secret) {
                const cleanUrl = new URL(pathname, request.url);
                const response = NextResponse.redirect(cleanUrl);
                response.cookies.set("admin_secret", secret, {
                    httpOnly: true,
                    secure: true,
                    sameSite: "strict",
                    maxAge: 86400, // 24 hours
                    path: "/admin",
                });
                return response;
            }
        }
    }

    // --- CSRF origin check (M6) ---
    const method = request.method.toUpperCase();
    const isStateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    const isApiRoute = pathname.startsWith("/api/");
    const isWebhook = pathname.startsWith("/api/webhook/");

    if (isStateChanging && isApiRoute && !isWebhook) {
        const origin = request.headers.get("origin");
        const host = request.headers.get("host");

        // Origin header must be present for state-changing requests
        if (origin && host) {
            try {
                const originHost = new URL(origin).host;
                if (originHost !== host) {
                    return NextResponse.json(
                        { error: "Cross-origin request blocked" },
                        { status: 403 }
                    );
                }
            } catch {
                return NextResponse.json(
                    { error: "Invalid origin" },
                    { status: 403 }
                );
            }
        }
        // If no Origin header, browser same-origin requests may omit it — allow
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/admin/:path*", "/api/:path*"],
};
