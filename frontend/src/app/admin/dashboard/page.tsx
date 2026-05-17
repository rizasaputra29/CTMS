'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { RecentList } from '@/components/dashboard/RecentList';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { SectionHeader } from '@/components/dashboard/SectionHeader';
import { useAuth } from '@/context/AuthContext';
import type { AxiosResponse } from 'axios';
import { Users, Calendar, GraduationCap, ClipboardCheck } from 'lucide-react';

interface ApiResponseData<T = unknown> {
  data?: T;
  [key: string]: unknown;
}

interface GroupItem {
  id: number;
  code?: string;
  status?: string;
}

const adminQuickActions = [
  { label: 'Manage Groups', href: '/admin/groups', icon: Users, description: 'View and manage' },
  { label: 'TA Defense', href: '/admin/ta-defense', icon: GraduationCap, description: 'Schedule defense' },
  { label: 'Schedule Exam', href: '/admin/schedule', icon: Calendar, description: 'SEMPRO & Expo' },
  { label: 'Finalization', href: '/admin/finalization', icon: ClipboardCheck, description: 'Finalize groups' },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<{
    totalUsers: number;
    totalPeriods: number;
    totalGroups: number;
    pendingFinalization: number;
    recentGroups: Array<{
      id: number;
      label: string;
      subtitle: string;
      status: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' };
      href: string;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [dashRes, periodsRes, groupsRes] = await Promise.allSettled([
          api.get('/admin/dashboard'),
          api.get('/admin/periods'),
          api.get('/admin/groups', { params: { per_page: 5 } }),
        ]);

        const getData = (result: PromiseSettledResult<AxiosResponse<ApiResponseData>>) =>
          result.status === 'fulfilled' ? result.value.data : null;

        const dashboardData = getData(dashRes);
        const periodsData = getData(periodsRes);
        const groupsData = getData(groupsRes);

        const periods = (periodsData?.data ?? periodsData ?? []) as unknown[];
        const groups = (groupsData?.data ?? groupsData ?? []) as GroupItem[];

        const totalUsers = (dashboardData as Record<string, unknown> | null)?.total_users as number ?? 0;
        const pendingFinalization = (Array.isArray(groups) ? groups : []).filter(
          (g: GroupItem) => g.status === 'READY_FOR_FINALIZATION'
        ).length;

        const recentGroups = (Array.isArray(groups) ? groups.slice(0, 5) : []).map((g: GroupItem) => ({
          id: g.id,
          label: g.code || `Group ${g.id}`,
          subtitle: g.status || '',
          status: {
            label: g.status || 'Unknown',
            variant: (g.status === 'READY_FOR_FINALIZATION' ? 'secondary' :
                     g.status === 'CLOSED' ? 'default' :
                     'outline') as 'default' | 'secondary' | 'destructive' | 'outline',
          },
          href: '/admin/groups',
        }));

        setData({
          totalUsers,
          totalPeriods: periods.length,
          totalGroups: Array.isArray(groups) ? groups.length : 0,
          pendingFinalization,
          recentGroups,
        });
      } catch {
        // Dashboard is non-critical
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return <div className="py-20 text-center text-muted-foreground">Failed to load dashboard data.</div>;
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {user?.name?.split(' ')[0] || 'User'}!
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your administration dashboard.
        </p>
      </div>

      <section className="space-y-4">
        <SectionHeader title="Admin Overview" description="System management & monitoring" />

        <div className="grid grid-cols-2 gap-3">
          <StatsCard
            title="Total Users"
            value={data.totalUsers}
            icon={Users}
            variant="primary"
          />
          <StatsCard
            title="Active Periods"
            value={data.totalPeriods}
            icon={Calendar}
          />
          <StatsCard
            title="Total Groups"
            value={data.totalGroups}
            icon={Users}
          />
          <StatsCard
            title="Pending Finalization"
            value={data.pendingFinalization}
            icon={ClipboardCheck}
            variant={data.pendingFinalization ? 'warning' : 'default'}
          />
        </div>

        <RecentList
          title="Recent Groups"
          items={data.recentGroups}
          viewAllHref="/admin/groups"
          emptyMessage="No groups yet"
        />

        <QuickActions actions={adminQuickActions} />
      </section>
    </>
  );
}
