import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
    AdminDashboardResponse,
    AdminGroupsResponse,
    AdminPeriodsResponse,
    AdminDashboardData,
    AdminDashboardGroupItem,
} from '@/features/admin/dashboard/types';

const fetchDashboard = async (): Promise<AdminDashboardResponse> => {
    const response = await api.get('/admin/dashboard');
    return response.data;
};

const fetchPeriods = async (): Promise<AdminPeriodsResponse> => {
    const response = await api.get('/admin/periods');
    return response.data;
};

const fetchGroups = async (): Promise<AdminGroupsResponse> => {
    const response = await api.get('/admin/groups', { params: { per_page: 5 } });
    return response.data;
};

export function useAdminDashboard() {
    const { data: dashboardData, isLoading: isDashboardLoading } = useQuery({
        queryKey: ['admin', 'dashboard'],
        queryFn: fetchDashboard,
    });

    const { data: periodsData, isLoading: isPeriodsLoading } = useQuery({
        queryKey: ['admin', 'periods'],
        queryFn: fetchPeriods,
    });

    const { data: groupsData, isLoading: isGroupsLoading } = useQuery({
        queryKey: ['admin', 'groups'],
        queryFn: fetchGroups,
    });

    const data = useMemo<AdminDashboardData | null>(() => {
        if (!dashboardData || !periodsData || !groupsData) return null;

        const periods = (periodsData?.data ?? periodsData ?? []) as unknown[];
        const groups = (groupsData?.data ?? groupsData ?? []) as AdminDashboardGroupItem[];

        const totalUsers = dashboardData?.total_users ?? 0;
        const pendingFinalization = (Array.isArray(groups) ? groups : []).filter(
            (g: AdminDashboardGroupItem) => g.status === 'READY_FOR_FINALIZATION'
        ).length;

        const recentGroups = (Array.isArray(groups) ? groups.slice(0, 5) : []).map(
            (g: AdminDashboardGroupItem) => ({
                id: g.id,
                label: g.code || `Group ${g.id}`,
                subtitle: g.status || '',
                status: {
                    label: g.status || 'Unknown',
                    variant: (g.status === 'READY_FOR_FINALIZATION'
                        ? 'secondary'
                        : g.status === 'CLOSED'
                            ? 'default'
                            : 'outline') as
                        | 'default'
                        | 'secondary'
                        | 'destructive'
                        | 'outline',
                },
                href: '/admin/groups',
            })
        );

        return {
            totalUsers,
            totalPeriods: periods.length,
            totalGroups: Array.isArray(groups) ? groups.length : 0,
            pendingFinalization,
            recentGroups,
        };
    }, [dashboardData, periodsData, groupsData]);

    const isLoading = isDashboardLoading || isPeriodsLoading || isGroupsLoading;

    return { data, isLoading };
}
