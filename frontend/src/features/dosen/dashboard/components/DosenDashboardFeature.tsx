"use client";

import { useAuth } from "@/context/AuthContext";
import { DashboardHeader } from "@/components/common/DashboardHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentList } from "@/components/dashboard/RecentList";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import {
  Users,
  Calendar,
  FileText,
  Star,
  Gavel,
  BookOpen,
  Loader2,
} from "lucide-react";
import { useDosenDashboard } from "../hooks/use-dosen-dashboard";

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

export function DosenDashboardFeature() {
  const { user } = useAuth();
  const {
    data,
    isLoading,
    isDashboardLoading,
    isSupervisedLoading,
    selectedPeriod,
    handlePeriodChange,
    periods,
  } = useDosenDashboard();

  return (
    <>
      <DashboardHeader
        title="Welcome back"
        userName={user?.name ?? null}
        subtitle="Here's an overview of your mentoring dashboard."
        loading={isDashboardLoading || isSupervisedLoading}
        showPeriodSelector
        periodValue={selectedPeriod}
        onPeriodChange={handlePeriodChange}
        periods={periods}
        periodLoading={isLoading}
      />

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
