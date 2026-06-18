import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check for Laravel session cookie for route protection
  const sessionCookie = request.cookies.get('sicata-session')?.value;

  // Protect dashboard routes
  const protectedPaths = ['/admin', '/mahasiswa', '/dosen'];
  const isProtectedPath = protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath && !sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/mahasiswa/:path*', '/dosen/:path*'],
};
