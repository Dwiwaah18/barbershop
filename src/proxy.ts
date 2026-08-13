import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';
import { isSupabaseConfigured } from '@/lib/supabase/config';

const STAFF_ROLES = ['cashier', 'barber', 'owner', 'superadmin'];
const OWNER_ROLES = ['owner', 'superadmin'];
const CASHIER_ROLES = ['cashier', 'owner', 'superadmin'];
const BARBER_ROLES = ['barber', 'owner', 'superadmin'];
const SUPERADMIN_ROLES = ['superadmin'];
const STAFF_PATHS = ['/queue', '/pos', '/shift', '/attendance'];
const OWNER_PATHS = ['/dashboard', '/staff', '/services', '/payroll', '/finance-report', '/attendance-report', '/wallet-report', '/shift-report', '/outlets'];
const CASHIER_PATHS = ['/topups', '/families'];
const BARBER_PATHS = ['/my-report', '/my-payroll'];
const SUPERADMIN_PATHS = ['/tenants'];
const AUTH_REQUIRED_PATHS = ['/profile', '/deposit', '/my-bookings'];

function matchesPath(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  const { supabase, supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isStaff = matchesPath(pathname, STAFF_PATHS);
  const isOwner = matchesPath(pathname, OWNER_PATHS);
  const isCashier = matchesPath(pathname, CASHIER_PATHS);
  const isBarberOnly = matchesPath(pathname, BARBER_PATHS);
  const isSuperadminOnly = matchesPath(pathname, SUPERADMIN_PATHS);
  const requiresAuth =
    isStaff || isOwner || isCashier || isBarberOnly || isSuperadminOnly || matchesPath(pathname, AUTH_REQUIRED_PATHS);

  if (requiresAuth && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/auth';
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if ((isStaff || isOwner || isCashier || isBarberOnly || isSuperadminOnly) && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const allowedRoles = isSuperadminOnly
      ? SUPERADMIN_ROLES
      : isOwner
        ? OWNER_ROLES
        : isCashier
          ? CASHIER_ROLES
          : isBarberOnly
            ? BARBER_ROLES
            : STAFF_ROLES;
    if (!profile || !allowedRoles.includes(profile.role)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/';
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/queue/:path*',
    '/pos/:path*',
    '/shift/:path*',
    '/attendance/:path*',
    '/dashboard/:path*',
    '/staff/:path*',
    '/services/:path*',
    '/payroll/:path*',
    '/finance-report/:path*',
    '/attendance-report/:path*',
    '/wallet-report/:path*',
    '/shift-report/:path*',
    '/outlets/:path*',
    '/tenants/:path*',
    '/my-report/:path*',
    '/my-payroll/:path*',
    '/topups/:path*',
    '/families/:path*',
    '/profile/:path*',
    '/deposit/:path*',
    '/my-bookings/:path*',
  ],
};
