import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@sarmata/services';
import { env } from '@/env';
import { routes } from '@/lib/routes';

// Headers that keep CDNs and reverse proxies from caching a response that sets session cookies.
const SESSION_HEADERS = ['cache-control', 'expires', 'pragma'];

/** Refreshes the Supabase session on every request and keeps signed-out visitors on the sign-in page. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = env();

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Nothing may run between createServerClient and getClaims, otherwise sessions get lost.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const onSignInPage = request.nextUrl.pathname === routes.signIn;

  if (!signedIn && !onSignInPage) return redirectKeepingSession(request, routes.signIn, response);
  if (signedIn && onSignInPage) return redirectKeepingSession(request, routes.home, response);
  return response;
}

function redirectKeepingSession(
  request: NextRequest,
  pathname: string,
  session: NextResponse,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  const redirect = NextResponse.redirect(url);
  for (const cookie of session.cookies.getAll()) redirect.cookies.set(cookie);
  for (const header of SESSION_HEADERS) {
    const value = session.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|__nextjs|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
