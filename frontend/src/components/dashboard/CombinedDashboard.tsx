"use client";

import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Toaster } from "@/components/ui/sonner";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentList } from "@/components/dashboard/RecentList";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import type { AxiosResponse } from "axios";
import {
  Users,
  BookOpen,
  Calendar,
  GraduationCap,
  FileText,
  ClipboardCheck,
  Gavel,
  Star,
} from "lucide-react";

interface ApiResponseData<T = unknown> {
  data?: T;
  [key: string]: unknown;
}

interface GroupItem {
  id: number;
  code?: string;
  status?: string;
  period?: { name?: string };
}

interface DashboardData {
  admin: {
    totalPeriods: number;
    totalUsers: number;
    totalGroups: number;
    pendingFinalization: number;
    recentGroups: Array<{
      id: number;
      label: string;
      subtitle: string;
      status: {
        label: string;
        variant: "default" | "secondary" | "destructive" | "outline";
      };
      href: string;
    }>;
  };
  dosen: {
    supervisedGroups: number;
    pendingEvaluations: number;
    pendingBids: number;
    upcomingSchedules: number;
    recentSubmissions: Array<{
      id: number;
      label: string;
      subtitle: string;
      status: {
        label: string;
        variant: "default" | "secondary" | "destructive" | "outline";
      };
      href: string;
    }>;
  };
}

export default function CombinedDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [periodsRes, groupsRes, supervisedRes, evalCountRes] =
          await Promise.allSettled([
            api.get("/admin/periods"),
            api.get("/admin/groups", { params: { per_page: 5 } }),
            api.get("/dosen/groups/supervised"),
            api.get("/dosen/supervisor-evaluation/pending-count"),
          ]);

        const getData = (
          result: PromiseSettledResult<AxiosResponse<ApiResponseData>>
        ) => (result.status === "fulfilled" ? result.value.data : null);

        const periodsData = getData(periodsRes);
        const groupsData = getData(groupsRes);
        const supervisedData = getData(supervisedRes);
        const evalCountData = getData(evalCountRes);

        const periods = periodsData?.data || periodsData || [];
        const groups = groupsData?.data || groupsData || [];
        const supervised = supervisedData?.data || supervisedData || [];

        // Transform recent groups
        const recentGroups = (
          Array.isArray(groups) ? groups.slice(0, 5) : []
        ).map((g: GroupItem) => ({
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
          href: `/admin/groups`,
        }));

        // Transform recent supervised groups
        const recentSubmissions = (
          Array.isArray(supervised) ? supervised.slice(0, 5) : []
        ).map((g: GroupItem) => ({
          id: g.id,
          label: g.code || `Group ${g.id}`,
          subtitle: `Period: ${g.period?.name || "N/A"}`,
          status: {
            label: g.status || "Active",
            variant: "outline" as const,
          },
          href: `/dosen/supervised-groups`,
        }));

        // Count pending finalization groups
        const pendingFinalization = Array.isArray(groups)
          ? groups.filter(
              (g: GroupItem) => g.status === "READY_FOR_FINALIZATION"
            ).length
          : 0;

        setData({
          admin: {
            totalPeriods: Array.isArray(periods) ? periods.length : 0,
            totalUsers: 0, // Will need a separate endpoint or count from another source
            totalGroups: Array.isArray(groups) ? groups.length : 0,
            pendingFinalization,
            recentGroups,
          },
          dosen: {
            supervisedGroups: Array.isArray(supervised) ? supervised.length : 0,
            pendingEvaluations:
              (evalCountData as { count?: number } | null)?.count || 0,
            pendingBids: 0, // Could fetch separately
            upcomingSchedules: 0, // Could fetch separately
            recentSubmissions,
          },
        });
      } catch {
        // Dashboard data is non-critical
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

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

  const dosenQuickActions = [
    {
      label: "Review TA",
      href: "/dosen/ta-review",
      icon: FileText,
      description: "Review submissions",
    },
    {
      label: "Evaluate",
      href: "/dosen/supervisor-evaluation",
      icon: Star,
      description: "Score students",
    },
    {
      label: "My Titles",
      href: "/dosen/titles",
      icon: BookOpen,
      description: "Manage titles",
    },
    {
      label: "Bids",
      href: "/dosen/bids",
      icon: Gavel,
      description: "Review bids",
    },
  ];

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex h-screen w-full flex-col overflow-hidden">
        <header className="bg-background z-10 flex shrink-0 items-center gap-2 border-b px-4 py-3">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold">
                  Dashboard
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="bg-muted/50 flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Welcome */}
              <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">
                  Welcome back, {user?.name?.split(" ")[0] || "User"}!
                </h1>
                <p className="text-muted-foreground">
                  Here&apos;s an overview of your academic dashboard.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Admin Section */}
                <section className="space-y-4">
                  <SectionHeader
                    title="Admin Overview"
                    description="System management & monitoring"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <StatsCard
                      title="Active Periods"
                      value={data?.admin.totalPeriods ?? 0}
                      icon={Calendar}
                      variant="primary"
                    />
                    <StatsCard
                      title="Total Groups"
                      value={data?.admin.totalGroups ?? 0}
                      icon={Users}
                    />
                    <StatsCard
                      title="Pending Finalization"
                      value={data?.admin.pendingFinalization ?? 0}
                      icon={ClipboardCheck}
                      variant={
                        data?.admin.pendingFinalization ? "warning" : "default"
                      }
                    />
                    <StatsCard
                      title="TA Defenses"
                      value={0}
                      subtitle="Scheduled this period"
                      icon={GraduationCap}
                    />
                  </div>

                  <RecentList
                    title="Recent Groups"
                    items={data?.admin.recentGroups || []}
                    viewAllHref="/admin/groups"
                    emptyMessage="No groups yet"
                  />

                  <QuickActions actions={adminQuickActions} />
                </section>

                {/* Dosen Section */}
                <section className="space-y-4">
                  <SectionHeader
                    title="Dosen Overview"
                    description="Teaching & mentoring activities"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <StatsCard
                      title="Supervised Groups"
                      value={data?.dosen.supervisedGroups ?? 0}
                      icon={Users}
                      variant="primary"
                    />
                    <StatsCard
                      title="Pending Evaluations"
                      value={data?.dosen.pendingEvaluations ?? 0}
                      icon={Star}
                      variant={
                        data?.dosen.pendingEvaluations ? "warning" : "default"
                      }
                    />
                    <StatsCard
                      title="Upcoming Schedules"
                      value={data?.dosen.upcomingSchedules ?? 0}
                      icon={Calendar}
                    />
                    <StatsCard
                      title="Pending Bids"
                      value={data?.dosen.pendingBids ?? 0}
                      icon={Gavel}
                    />
                  </div>

                  <RecentList
                    title="Supervised Groups"
                    items={data?.dosen.recentSubmissions || []}
                    viewAllHref="/dosen/supervised-groups"
                    emptyMessage="No supervised groups yet"
                  />

                  <QuickActions actions={dosenQuickActions} />
                </section>
              </div>
            </>
          )}
        </div>
        <Toaster />
      </main>
    </SidebarProvider>
  );
}
