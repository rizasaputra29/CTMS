import { cookies } from 'next/headers';
import { cache } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://148.230.99.31/api';

// Server-safe API call with session cookie forwarding
async function serverFetch(endpoint: string, options: RequestInit = {}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('sicata-session')?.value;

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(sessionCookie && { Cookie: `sicata-session=${sessionCookie}` }),
      ...options.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API call failed: ${res.statusText}`);
  }

  return res.json();
}

// Cached data fetching using React.cache
export const getDashboardStats = cache(async () => {
  return serverFetch('/admin/dashboard/stats', {
    next: { revalidate: 60 }, // Cache for 60 seconds
  });
});

export const getPeriods = cache(async () => {
  return serverFetch('/admin/periods', {
    next: { revalidate: 300 }, // Cache for 5 minutes (periods don't change often)
  });
});

export const getActivePeriod = cache(async () => {
  const periods = await getPeriods();
  return periods.data?.find((p: { is_active: boolean }) => p.is_active) || null;
});

export const getGroups = cache(async (periodId?: string) => {
  const query = periodId ? `?period_id=${periodId}` : '';
  return serverFetch(`/admin/groups${query}`, {
    next: { revalidate: 60 },
  });
});

export const getUsers = cache(async (role?: string) => {
  const query = role ? `?role=${role}` : '';
  return serverFetch(`/admin/users${query}`, {
    next: { revalidate: 120 }, // Cache for 2 minutes
  });
});

export const getSchedules = cache(async (type: 'sempro' | 'ta-defense', periodId?: string) => {
  const query = periodId ? `?period_id=${periodId}` : '';
  return serverFetch(`/admin/${type}/schedules${query}`, {
    next: { revalidate: 30 }, // Shorter cache for schedules (30 seconds)
  });
});

export const getTitles = cache(async (params?: { period_id?: string; status?: string }) => {
  const queryParams = new URLSearchParams();
  if (params?.period_id) queryParams.set('period_id', params.period_id);
  if (params?.status) queryParams.set('status', params.status);
  
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  return serverFetch(`/admin/titles${query}`, {
    next: { revalidate: 60 },
  });
});

// Example: Combined dashboard data with parallel fetching
export const getAdminDashboardData = cache(async () => {
  // Parallel data fetching
  const [stats, periods, activeGroups, recentSchedules] = await Promise.all([
    getDashboardStats(),
    getPeriods(),
    getGroups(),
    getSchedules('sempro'),
  ]);
  
  return {
    stats,
    periods,
    activeGroups,
    recentSchedules,
  };
});
