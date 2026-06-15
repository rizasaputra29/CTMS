'use client';

import { useAuth } from '@/context/AuthContext';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { RecentList } from '@/components/dashboard/RecentList';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { SectionHeader } from '@/components/dashboard/SectionHeader';
import { useAdminDashboard } from '@/features/admin/dashboard/hooks/use-admin-dashboard';
import { Users, Calendar, GraduationCap, ClipboardCheck, Loader2 } from 'lucide-react';

const adminQuickActions = [
    {
        label: 'Manage Groups',
        href: '/admin/groups',
        icon: Users,
        description: 'View and manage',
    },
    {
        label: 'TA Defense',
        href: '/admin/ta-defense',
        icon: GraduationCap,
        description: 'Schedule defense',
    },
    {
        label: 'Schedule Exam',
        href: '/admin/schedule',
        icon: Calendar,
        description: 'SEMPRO & Expo',
    },
    {
        label: 'Finalization',
        href: '/admin/finalization',
        icon: ClipboardCheck,
        description: 'Finalize groups',
    },
];

export function AdminDashboardFeature() {
    const { user } = useAuth();
    const { data, isLoading } = useAdminDashboard();

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
                <SectionHeader
                    title="Admin Overview"
                    description="System management & monitoring"
                />

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
                    </div>
                ) : !data ? (
                    <div className="text-muted-foreground py-20 text-center">
                        Failed to load dashboard data.
                    </div>
                ) : (
                    <>
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
                    </>
                )}
            </section>
        </>
    );
}
