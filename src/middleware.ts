import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in and trying to access protected route → redirect to login
  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Logged in — check if user is approved (active status)
  if (user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("status")
      .eq("id", user.id)
      .single();

    // If the DB query failed, let the user through rather than locking them out
    if (profileError || !profile) {
      return response;
    }

    if (profile.status !== "active") {
      // Pending/rejected/inactive user — send to a holding page
      const url = request.nextUrl.clone();
      url.pathname = "/pending";
      return NextResponse.redirect(url);
    }
  }

  // Logged in and on login page → redirect to dashboard
  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
