'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { RecentList } from '@/components/dashboard/RecentList';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { SectionHeader } from '@/components/dashboard/SectionHeader';
import { useAuth } from '@/context/AuthContext';
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Users, Calendar, FileText, Star, Gavel, BookOpen, Loader2 } from 'lucide-react';
import { Loading } from '@/components/ui/loading';

interface Period {
  id: number;
  name: string;
  is_active: boolean;
}

interface SupervisedGroup {
  id: number;
  code?: string;
  status?: string;
  period?: { name?: string };
}

interface DashboardData {
  supervisedGroups: number;
  pendingEvaluations: number;
  pendingProposals: number;
  availablePeriods: number;
  recentSubmissions: Array<{
    id: number;
    label: string;
    subtitle: string;
    status: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' };
    href: string;
  }>;
}

const dosenQuickActions = [
  { label: 'Review TA', href: '/dosen/ta-review', icon: FileText, description: 'Review submissions' },
  { label: 'Evaluate', href: '/dosen/supervisor-evaluation', icon: Star, description: 'Score students' },
  { label: 'My Titles', href: '/dosen/titles', icon: BookOpen, description: 'Manage titles' },
  { label: 'Bids', href: '/dosen/bids', icon: Gavel, description: 'Review bids' },
];

export default function DosenDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [periods, setPeriods] = useState<Period[]>([]);

  const fetchData = useCallback(async (periodId?: string) => {
    const isRefresh = !!periodId;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const periodParams = periodId ? { params: { period_id: periodId } } : undefined;
      const [dashRes, supervisedRes, evalCountRes] = await Promise.allSettled([
        api.get('/dosen/dashboard', periodParams),
        api.get('/dosen/groups/supervised', periodParams),
        api.get('/dosen/supervisor-evaluation/pending-count'),
      ]);

      const getData = <T,>(r: PromiseSettledResult<{ data: T }>) =>
        r.status === 'fulfilled' ? r.value.data : null;

      const dashboardData = getData(dashRes) as Record<string, unknown> | null;
      const supervisedResolved = getData(supervisedRes) as { data?: SupervisedGroup[] } | Record<string, unknown> | null;
      const evaluated = getData(evalCountRes) as { count?: number } | null;

      const supervisedArr: SupervisedGroup[] =
        (supervisedResolved as { data?: SupervisedGroup[] })?.data ??
        (Array.isArray(supervisedResolved) ? (supervisedResolved as unknown as SupervisedGroup[]) : []);

      const allPeriods = (dashboardData?.available_periods as Period[]) || [];
      setPeriods(allPeriods);

      const recentSubmissions = supervisedArr.slice(0, 5).map((g) => ({
        id: g.id,
        label: g.code || `Group ${g.id}`,
        subtitle: `Period: ${g.period?.name || 'N/A'}`,
        status: {
          label: g.status || 'Active',
          variant: 'outline' as const,
        },
        href: '/dosen/supervised-groups',
      }));

      setData({
        supervisedGroups: (dashboardData?.active_groups as number) ?? 0,
        pendingEvaluations: evaluated?.count ?? 0,
        pendingProposals: (dashboardData?.pending_proposals as number) ?? 0,
        availablePeriods: allPeriods.length,
        recentSubmissions,
      });
    } catch {
      // Dashboard is non-critical
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePeriodChange = (value: string) => {
    setSelectedPeriod(value);
    fetchData(value);
  };

  if (loading) return <Loading variant="section" />;

  if (!data) {
    return <div className="py-20 text-center text-muted-foreground">Failed to load dashboard data.</div>;
  }

  return (
    <>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {user?.name?.split(' ')[0] || 'User'}!
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s an overview of your mentoring dashboard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">View Period:</span>
          <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Available Periods</SelectLabel>
                <SelectItem value="all">All Periods</SelectItem>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name} {p.is_active && '(Active)'}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {refreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <section className="space-y-4">
        <SectionHeader title="Dosen Overview" description="Teaching & mentoring activities" />

        <div className="grid grid-cols-2 gap-3">
          <StatsCard
            title="Supervised Groups"
            value={data.supervisedGroups}
            icon={Users}
            variant="primary"
          />
          <StatsCard
            title="Pending Evaluations"
            value={data.pendingEvaluations}
            icon={Star}
            variant={data.pendingEvaluations ? 'warning' : 'default'}
          />
          <StatsCard
            title="Pending Proposals"
            value={data.pendingProposals}
            icon={FileText}
            variant={data.pendingProposals ? 'warning' : 'default'}
          />
          <StatsCard
            title="Available Periods"
            value={data.availablePeriods}
            icon={Calendar}
          />
        </div>

        <RecentList
          title="Supervised Groups"
          items={data.recentSubmissions}
          viewAllHref="/dosen/supervised-groups"
          emptyMessage="No supervised groups yet"
        />

        <QuickActions actions={dosenQuickActions} />
      </section>
    </>
  );
}
