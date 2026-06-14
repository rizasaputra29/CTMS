"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentList } from "@/components/dashboard/RecentList";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { useAuth } from "@/context/AuthContext";
import {
  Users,
  Calendar,
  GraduationCap,
  ClipboardCheck,
  Loader2,
} from "lucide-react";

interface GroupItem {
  id: number;
  code?: string;
  status?: string;
}

interface DashboardResponse {
  total_users?: number;
}

interface PeriodsResponse {
  data?: unknown[];
}

interface GroupsResponse {
  data?: GroupItem[];
}

const adminQuickActions = [
  {
    label: "Manage Groups",
    href: "/admin/groups",
    icon: Users,
    description: "View and manage",
  },
  {
    label: "TA Defense",
    href: "/admin/ta-defense",
    icon: GraduationCap,
    description: "Schedule defense",
  },
  {
    label: "Schedule Exam",
    href: "/admin/schedule",
    icon: Calendar,
    description: "SEMPRO & Expo",
  },
  {
    label: "Finalization",
    href: "/admin/finalization",
    icon: ClipboardCheck,
    description: "Finalize groups",
  },
];

// Query functions
const fetchDashboard = async (): Promise<DashboardResponse> => {
  const response = await api.get("/admin/dashboard");
  return response.data;
};

const fetchPeriods = async (): Promise<PeriodsResponse> => {
  const response = await api.get("/admin/periods");
  return response.data;
};

const fetchGroups = async (): Promise<GroupsResponse> => {
  const response = await api.get("/admin/groups", { params: { per_page: 5 } });
  return response.data;
};

export default function AdminDashboard() {
  const { user } = useAuth();

  // Parallel queries with React Query
  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: fetchDashboard,
  });

  const { data: periodsData, isLoading: isPeriodsLoading } = useQuery({
    queryKey: ["admin", "periods"],
    queryFn: fetchPeriods,
  });

  const { data: groupsData, isLoading: isGroupsLoading } = useQuery({
    queryKey: ["admin", "groups"],
    queryFn: fetchGroups,
  });

  // Memoized derived data
  const data = useMemo(() => {
    if (!dashboardData || !periodsData || !groupsData) return null;

    const periods = (periodsData?.data ?? periodsData ?? []) as unknown[];
    const groups = (groupsData?.data ?? groupsData ?? []) as GroupItem[];

    const totalUsers = dashboardData?.total_users ?? 0;
    const pendingFinalization = (Array.isArray(groups) ? groups : []).filter(
      (g: GroupItem) => g.status === "READY_FOR_FINALIZATION"
    ).length;

    const recentGroups = (Array.isArray(groups) ? groups.slice(0, 5) : []).map(
      (g: GroupItem) => ({
        id: g.id,
        label: g.code || `Group ${g.id}`,
        subtitle: g.status || "",
        status: {
          label: g.status || "Unknown",
          variant: (g.status === "READY_FOR_FINALIZATION"
            ? "secondary"
            : g.status === "CLOSED"
              ? "default"
              : "outline") as
            | "default"
            | "secondary"
            | "destructive"
            | "outline",
        },
        href: "/admin/groups",
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

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {user?.name?.split(" ")[0] || "User"}!
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
                variant={data.pendingFinalization ? "warning" : "default"}
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
