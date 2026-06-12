"use client";

import { useMemo, useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentList } from "@/components/dashboard/RecentList";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { useAuth } from "@/context/AuthContext";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Calendar,
  FileText,
  Star,
  Gavel,
  BookOpen,
  Loader2,
} from "lucide-react";

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

interface DashboardResponse {
  active_groups?: number;
  pending_proposals?: number;
  available_periods?: Period[];
}

interface SupervisedResponse {
  data?: SupervisedGroup[];
}

interface EvalCountResponse {
  count?: number;
}

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

// Query functions
const fetchDashboard = async (
  periodId?: string
): Promise<DashboardResponse> => {
  const params = periodId ? { period_id: periodId } : undefined;
  const response = await api.get("/dosen/dashboard", { params });
  return response.data;
};

const fetchSupervised = async (
  periodId?: string
): Promise<SupervisedResponse> => {
  const params = periodId ? { period_id: periodId } : undefined;
  const response = await api.get("/dosen/groups/supervised", { params });
  return response.data;
};

const fetchEvalCount = async (): Promise<EvalCountResponse> => {
  const response = await api.get("/dosen/supervisor-evaluation/pending-count");
  return response.data;
};

export default function DosenDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");

  const periodParam = useMemo(
    () => (selectedPeriod === "all" ? undefined : selectedPeriod),
    [selectedPeriod]
  );

  // Parallel queries with React Query
  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery({
    queryKey: ["dosen", "dashboard", periodParam],
    queryFn: () => fetchDashboard(periodParam),
  });

  const { data: supervisedData, isLoading: isSupervisedLoading } = useQuery({
    queryKey: ["dosen", "supervised", periodParam],
    queryFn: () => fetchSupervised(periodParam),
  });

  const { data: evalCountData, isLoading: isEvalLoading } = useQuery({
    queryKey: ["dosen", "eval-count"],
    queryFn: fetchEvalCount,
  });

  // Memoized derived data
  const data = useMemo(() => {
    if (!dashboardData || !supervisedData) return null;

    const allPeriods = dashboardData?.available_periods || [];
    const supervisedArr: SupervisedGroup[] =
      supervisedData?.data ??
      (Array.isArray(supervisedData) ? supervisedData : []);

    const recentSubmissions = supervisedArr.slice(0, 5).map((g) => ({
      id: g.id,
      label: g.code || `Group ${g.id}`,
      subtitle: `Period: ${g.period?.name || "N/A"}`,
      status: {
        label: g.status || "Active",
        variant: "outline" as const,
      },
      href: "/dosen/supervised-groups",
    }));

    return {
      supervisedGroups: dashboardData?.active_groups ?? 0,
      pendingEvaluations: evalCountData?.count ?? 0,
      pendingProposals: dashboardData?.pending_proposals ?? 0,
      availablePeriods: allPeriods.length,
      periods: allPeriods,
      recentSubmissions,
    };
  }, [dashboardData, supervisedData, evalCountData]);

  const isLoading = isDashboardLoading || isSupervisedLoading || isEvalLoading;

  const handlePeriodChange = useCallback(
    (value: string) => {
      setSelectedPeriod(value);
      // Invalidate queries to refetch with new period
      const newPeriod = value === "all" ? undefined : value;
      queryClient.invalidateQueries({
        queryKey: ["dosen", "dashboard", newPeriod],
      });
      queryClient.invalidateQueries({
        queryKey: ["dosen", "supervised", newPeriod],
      });
    },
    [queryClient]
  );

  return (
    <>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {user?.name?.split(" ")[0] || "User"}!
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s an overview of your mentoring dashboard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            View Period:
          </span>
          <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Available Periods</SelectLabel>
                <SelectItem value="all">All Periods</SelectItem>
                {isLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading...
                  </SelectItem>
                ) : (
                  data?.periods.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name} {p.is_active && "(Active)"}
                    </SelectItem>
                  ))
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
          {(isDashboardLoading || isSupervisedLoading) && (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          )}
        </div>
      </div>

      <section className="space-y-4">
        <SectionHeader
          title="Dosen Overview"
          description="Teaching & mentoring activities"
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
                title="Supervised Groups"
                value={data.supervisedGroups}
                icon={Users}
                variant="primary"
              />
              <StatsCard
                title="Pending Evaluations"
                value={data.pendingEvaluations}
                icon={Star}
                variant={data.pendingEvaluations ? "warning" : "default"}
              />
              <StatsCard
                title="Pending Proposals"
                value={data.pendingProposals}
                icon={FileText}
                variant={data.pendingProposals ? "warning" : "default"}
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
          </>
        )}
      </section>
    </>
  );
}
