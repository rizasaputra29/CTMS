"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Loading } from "@/components/ui/loading";
import { Badge } from "@/components/ui/badge";
import { DashboardHeader } from "@/components/common/DashboardHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusGroup } from "@/components/dashboard/StatusGroup";
import { GroupProjectCard } from "@/components/dashboard/GroupProjectCard";
import { MiniScheduleCalendar } from "@/components/dashboard/MiniScheduleCalendar";
import { DocumentUploadTable } from "@/components/dashboard/DocumentUploadTable";
import { QuickAccessCard } from "@/components/dashboard/QuickAccessCard";
import { useMahasiswaDashboard } from "../hooks/use-mahasiswa-dashboard";

export function MahasiswaDashboardFeature() {
  const { user } = useAuth();
  const { stats, group, schedules, workflow, loading } = useMahasiswaDashboard();

  if (loading) return <Loading variant="section" />;

  if (!stats) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Gagal memuat data dashboard"
        description="Silakan coba lagi atau muat ulang halaman."
      />
    );
  }

  // has_group from stats can be unreliable; use actual group data presence
  const hasGroupApproved = !!group?.id && !!group?.status;

  const periodName =
    stats.group_period?.name ||
    (stats.active_periods?.length > 0 ? stats.active_periods[0].name : "N/A");

  return (
    <div className="flex flex-col space-y-6">
      <DashboardHeader
        title="Halo"
        userName={user?.name ?? null}
        className="mb-0"
      />

      {/* Status Group */}
      <StatusGroup
        phases={workflow?.phases}
        currentPhase={workflow?.current_phase}
        periodName={periodName}
      />

      {/* Row 1: Group Project + Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {hasGroupApproved && group ? (
          <GroupProjectCard
            group={group}
            workflow={workflow}
            title={stats.title}
          />
        ) : (
          <EmptyState
            title="Anda belum memiliki grup yang disetujui"
            action={
              <Link href="/mahasiswa/group">
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-primary-50"
                >
                  Buat / Cari Kelompok
                </Badge>
              </Link>
            }
            className="bg-white shadow-sm"
          />
        )}
        <MiniScheduleCalendar events={schedules} />
      </div>

      {/* Row 2: Upload Document + Akses Cepat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DocumentUploadTable phases={workflow?.phases} />
        </div>
        <div className="lg:col-span-1">
          <QuickAccessCard />
        </div>
      </div>
    </div>
  );
}
