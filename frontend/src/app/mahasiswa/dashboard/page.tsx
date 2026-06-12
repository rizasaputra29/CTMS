"use client";

import { useMemo, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  Calendar,
  Clock,
  Upload,
  Check,
  Lock,
  GraduationCap,
  AlertCircle,
  FileText,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Circle,
  Users,
  FileCheck,
  Mic,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { isFinalReadyEvaluationSection } from "@/types/guards";
import type {
  MahasiswaStats,
  WorkflowPhase,
  SupervisorInEvaluation,
  EvaluationWithSupervisors,
} from "@/types";
import { Loading } from "@/components/ui/loading";

interface ScheduleItem {
  id: string | number;
  type: "BIMBINGAN" | "SEMPRO" | "EXPO" | "TA_DEFENSE";
  date: string;
  room: string;
  mode: "ONLINE" | "OFFLINE" | null;
  notes: string | null;
  time_until: string;
}

// Static mappings
const PHASE_LABELS: Record<string, string> = {
  PDC1: "PDC 1",
  SEMPRO: "Seminar Proposal",
  PDC2: "PDC 2",
  TA_DRAFT: "TA Draft (Grup)",
  EXPO: "Expo",
  TA: "TA",
  SIDANG: "Sidang",
  TA_INDIVIDUAL_READY: "Siap TA Individu",
};

const STATUS_COLORS: Record<
  string,
  { bg: string; border: string; text: string; ring: string }
> = {
  completed: {
    bg: "bg-emerald-500",
    border: "border-emerald-500",
    text: "text-white",
    ring: "ring-emerald-500/20",
  },
  submitted: {
    bg: "bg-blue-500",
    border: "border-blue-500",
    text: "text-white",
    ring: "ring-blue-500/20",
  },
  draft: {
    bg: "bg-amber-500",
    border: "border-amber-500",
    text: "text-white",
    ring: "ring-amber-500/20",
  },
  revision: {
    bg: "bg-red-500",
    border: "border-red-500",
    text: "text-white",
    ring: "ring-red-500/20",
  },
  unlocked: {
    bg: "bg-background",
    border: "border-primary",
    text: "text-primary",
    ring: "ring-primary/20",
  },
  locked: {
    bg: "bg-muted",
    border: "border-muted-foreground/20",
    text: "text-muted-foreground",
    ring: "",
  },
};

const SCHEDULE_COLORS: Record<string, string> = {
  BIMBINGAN: "bg-blue-50 text-blue-700 border-blue-200",
  SEMPRO: "bg-primary-50 text-primary-500 border-primary-200",
  EXPO: "bg-orange-50 text-orange-700 border-orange-200",
  TA_DEFENSE: "bg-red-50 text-red-700 border-red-200",
};

const SCHEDULE_LABELS: Record<string, string> = {
  BIMBINGAN: "Bimbingan",
  SEMPRO: "Sempro",
  EXPO: "Expo",
  TA_DEFENSE: "Sidang TA",
};

// Static grid column classes for Tailwind
const GRID_COLS: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
  7: "md:grid-cols-7",
  8: "md:grid-cols-8",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Selesai",
  submitted: "Terkirim",
  draft: "Draft",
  revision: "Revisi",
  unlocked: "Terbuka",
  locked: "Terkunci",
};

interface MyPeriodResponse {
  period?: unknown;
  auto_registered?: boolean;
  message?: string;
}

interface WorkflowResponse {
  phases?: WorkflowPhase[];
  current_phase?: string;
  is_graduated?: boolean;
}

// Query functions
const fetchMyPeriod = async (): Promise<MyPeriodResponse> => {
  const response = await api.get("/mahasiswa/my-period");
  return response.data;
};

const fetchDashboard = async (): Promise<MahasiswaStats> => {
  const response = await api.get("/mahasiswa/dashboard");
  return response.data;
};

const fetchWorkflow = async (): Promise<WorkflowResponse> => {
  const response = await api.get("/mahasiswa/dashboard/workflow");
  return response.data;
};

// Memoized Status Icon component
const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case "completed":
      return <Check className="h-5 w-5" />;
    case "submitted":
      return <Clock className="h-5 w-5" />;
    case "draft":
      return <FileText className="h-5 w-5" />;
    case "revision":
      return <AlertTriangle className="h-5 w-5" />;
    case "locked":
      return <Lock className="h-4 w-4" />;
    default:
      return <Circle className="h-5 w-5" />;
  }
};

export default function MahasiswaDashboard() {
  const { user } = useAuth();
  const [showRequirements, setShowRequirements] = useState(false);

  // Parallel queries for initial data
  const {
    data: periodData,
    isLoading: isPeriodLoading,
    error: periodError,
  } = useQuery({
    queryKey: ["mahasiswa", "my-period"],
    queryFn: fetchMyPeriod,
  });

  const {
    data: stats,
    isLoading: isStatsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ["mahasiswa", "dashboard"],
    queryFn: fetchDashboard,
    // Only fetch if period check passed
    enabled: !!periodData?.period,
  });

  // Dependent query for workflow
  const isGroupApproved = useMemo(() => {
    if (!stats?.group_status) return false;
    return ![
      "FORMING",
      "FORMING_SOLO",
      "READY_FOR_BIDDING",
      "REJECTED",
    ].includes(stats.group_status);
  }, [stats?.group_status]);

  const shouldFetchWorkflow = useMemo(
    () => stats?.has_group && isGroupApproved,
    [stats?.has_group, isGroupApproved]
  );

  const { data: workflowData, isLoading: isWorkflowLoading } = useQuery({
    queryKey: ["mahasiswa", "workflow"],
    queryFn: fetchWorkflow,
    enabled: shouldFetchWorkflow,
  });

  // Redirect if no registration (using useEffect to avoid render-phase redirect)
  useMemo(() => {
    if (periodError || (periodData && !periodData.period)) {
      window.location.href = "/mahasiswa/registration";
    }
  }, [periodData, periodError]);

  // Show auto-registration toast
  useMemo(() => {
    if (periodData?.auto_registered) {
      toast.success(
        periodData.message ||
          "Anda telah terdaftar otomatis berdasarkan grup yang sudah ada."
      );
    }
  }, [periodData?.auto_registered, periodData?.message]);

  // Memoized derived data
  const mergedStats = useMemo(() => {
    if (!stats) return null;
    return workflowData ? { ...stats, ...workflowData } : stats;
  }, [stats, workflowData]);

  const workflowPhases = useMemo(
    () => mergedStats?.workflow?.phases || [],
    [mergedStats?.workflow?.phases]
  );

  const currentPhase = useMemo(
    () => mergedStats?.workflow?.current_phase,
    [mergedStats?.workflow?.current_phase]
  );

  const phaseKeys = useMemo(
    () => Object.keys(mergedStats?.steps || {}),
    [mergedStats?.steps]
  );

  const donePhases = useMemo(
    () => phaseKeys.filter((k) => mergedStats?.steps?.[k]).length,
    [phaseKeys, mergedStats?.steps]
  );

  const totalPhases = useMemo(() => phaseKeys.length, [phaseKeys]);

  const progressPercent = useMemo(
    () => (totalPhases > 0 ? Math.round((donePhases / totalPhases) * 100) : 0),
    [donePhases, totalPhases]
  );

  const schedules: ScheduleItem[] = useMemo(
    () =>
      (mergedStats as unknown as { upcoming_schedules?: ScheduleItem[] })
        ?.upcoming_schedules || [],
    [mergedStats]
  );

  const isSoloSeeker = useMemo(
    () =>
      stats?.group_status &&
      ["FORMING_SOLO", "FORMING"].includes(stats.group_status),
    [stats?.group_status]
  );

  // Memoized progress chart data
  const chartData = useMemo(
    () => [
      { name: "done", value: donePhases },
      { name: "remaining", value: totalPhases - donePhases },
    ],
    [donePhases, totalPhases]
  );

  // Memoized click handler
  const toggleRequirements = useCallback(() => {
    setShowRequirements((prev) => !prev);
  }, []);

  // Loading state
  const isLoading = isPeriodLoading || isStatsLoading;

  return (
    <div className="flex flex-col space-y-6">
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      ) : !mergedStats ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground text-sm">
            Gagal memuat data dashboard.
          </p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Halo, {user?.name || "Mahasiswa"}
              </h1>
              <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-sm">
                <Calendar className="h-3.5 w-3.5" />
                {mergedStats.group_period?.name ||
                  (mergedStats.active_periods?.length > 0
                    ? mergedStats.active_periods[0].name
                    : "N/A")}
              </p>
            </div>
            <Badge
              variant={mergedStats.is_graduated ? "default" : "secondary"}
              className={cn(
                "h-6 text-xs",
                mergedStats.is_graduated &&
                  "bg-emerald-500 hover:bg-emerald-500"
              )}
            >
              {mergedStats.is_graduated
                ? "Lulus"
                : mergedStats.group_status || "Belum Terdaftar"}
            </Badge>
          </div>

          {/* Workflow Stepper */}
          {workflowPhases.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
                  Alur Kerja
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {mergedStats.is_graduated && (
                  <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-700">
                    Semua fase telah diselesaikan.
                  </div>
                )}

                <div className="relative">
                  {workflowPhases.length > 1 && (
                    <div
                      className="bg-muted absolute top-6 z-0 hidden h-0.5 md:block"
                      style={{
                        left: `calc(100% / ${2 * workflowPhases.length})`,
                        right: `calc(100% / ${2 * workflowPhases.length})`,
                      }}
                    />
                  )}
                  <div
                    className={cn(
                      "relative z-10 grid grid-cols-1 gap-4",
                      GRID_COLS[workflowPhases.length] || GRID_COLS[4]
                    )}
                  >
                    {workflowPhases.map((phase) => {
                      const colors = STATUS_COLORS[phase.status];
                      const active = phase.phase === currentPhase;
                      return (
                        <div
                          key={phase.phase}
                          className="flex flex-col items-center text-center"
                        >
                          <div
                            className={cn(
                              "mb-2 flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all",
                              colors.bg,
                              colors.border,
                              colors.text,
                              active && colors.ring && "ring-4",
                              colors.ring
                            )}
                          >
                            <StatusIcon status={phase.status} />
                          </div>
                          <p
                            className={cn(
                              "text-sm font-medium",
                              phase.status === "locked" &&
                                "text-muted-foreground"
                            )}
                          >
                            {PHASE_LABELS[phase.phase] || phase.phase}
                          </p>
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {STATUS_LABELS[phase.status] || phase.status}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isWorkflowLoading && !mergedStats?.workflow?.phases && (
            <div className="flex justify-center py-4">
              <div className="border-primary h-6 w-6 animate-spin rounded-full border-b-2" />
            </div>
          )}

          {/* Main Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Progress Overview */}
            <Card className="flex flex-col justify-center lg:col-span-2">
              <CardContent className="flex items-center justify-between gap-6 p-6">
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-sm">
                    Progres Capaian
                  </p>
                  <p className="mt-0.5 text-xl font-semibold">
                    {donePhases}/{totalPhases} fase
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {phaseKeys.map((key) => (
                      <Badge
                        key={key}
                        variant={
                          mergedStats.steps[key] ? "default" : "secondary"
                        }
                        className={cn(
                          "h-5 text-[11px]",
                          mergedStats.steps[key] &&
                            "bg-emerald-500 hover:bg-emerald-500"
                        )}
                      >
                        {PHASE_LABELS[key] || key}
                      </Badge>
                    ))}
                  </div>

                  <div className="bg-muted mt-4 h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold tabular-nums">
                      {progressPercent}%
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={40}
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                        cornerRadius={6}
                        strokeWidth={0}
                      >
                        <Cell fill="var(--primary)" />
                        <Cell fill="var(--muted)" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Aksi Cepat
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 pt-0">
                {!mergedStats.has_group ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 w-full justify-between"
                      asChild
                    >
                      <Link href="/mahasiswa/group">
                        {isSoloSeeker
                          ? "Cari Kelompok"
                          : "Buat / Cari Kelompok"}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 w-full justify-between"
                      asChild
                    >
                      <Link href="/mahasiswa/titles">
                        Jelajahi Judul
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </>
                ) : isGroupApproved ? (
                  <Button
                    size="sm"
                    className="h-9 w-full justify-between"
                    asChild
                  >
                    <Link href="/mahasiswa/documents">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Dokumen
                      <ArrowRight className="ml-auto h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-9 w-full"
                    variant="secondary"
                    disabled
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    Menunggu Persetujuan
                  </Button>
                )}
                <Separator className="my-1" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 w-full justify-start"
                  asChild
                >
                  <Link href="/mahasiswa/schedule">
                    <Calendar className="mr-2 h-4 w-4" />
                    Jadwal Saya
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 w-full justify-start"
                  asChild
                >
                  <Link href="/mahasiswa/grades">
                    <GraduationCap className="mr-2 h-4 w-4" />
                    Nilai Saya
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Project Details */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Proyek</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div>
                  <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase">
                    Judul
                  </p>
                  <p
                    className="line-clamp-2 text-sm leading-snug font-medium"
                    title={mergedStats.title || "Belum ada judul"}
                  >
                    {mergedStats.title || "Belum ada judul"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase">
                    Status Grup
                  </p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      isGroupApproved
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : String(mergedStats.group_status) === "REJECTED"
                          ? "border-red-300 bg-red-50 text-red-700"
                          : ""
                    )}
                  >
                    {mergedStats.group_status || "Tidak Tergabung"}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase">
                    Fase Aktif
                  </p>
                  <p className="text-sm font-medium">
                    {currentPhase
                      ? PHASE_LABELS[currentPhase] || currentPhase
                      : mergedStats.is_graduated
                        ? "Selesai"
                        : "—"}
                  </p>
                </div>
                <Separator className="mx-0!" />
                <div>
                  <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase">
                    Periode
                  </p>
                  <p className="text-primary text-sm font-medium">
                    {mergedStats.group_period?.name || "Belum Terdaftar"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Schedules */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Jadwal Mendatang
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {schedules.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {schedules.map((s, i) => (
                      <div
                        key={s.id}
                        className={cn(
                          "rounded-lg border p-3",
                          i === 0
                            ? "bg-primary/5 border-primary/20"
                            : "bg-muted/30 border-transparent"
                        )}
                      >
                        <div className="mb-1.5 flex items-start justify-between gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 text-[10px] font-semibold tracking-wider uppercase",
                              SCHEDULE_COLORS[s.type] || ""
                            )}
                          >
                            {SCHEDULE_LABELS[s.type] || s.type}
                          </Badge>
                          <span className="text-muted-foreground text-[11px] whitespace-nowrap">
                            {s.time_until}
                          </span>
                        </div>
                        <p className="text-xs leading-snug font-medium">
                          {new Date(s.date).toLocaleDateString("id-ID", {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[11px]">
                          <span className="truncate">{s.room}</span>
                          {s.mode && (
                            <span className="shrink-0">| {s.mode}</span>
                          )}
                        </div>
                        {s.notes && (
                          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-[11px]">
                            {s.notes}
                          </p>
                        )}
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full justify-between"
                      asChild
                    >
                      <Link href="/mahasiswa/schedule">
                        Lihat Semua Jadwal
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Calendar className="text-muted-foreground/30 mb-3 h-10 w-10" />
                    <p className="text-muted-foreground text-sm">
                      Belum ada jadwal
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-4 justify-between"
                      asChild
                    >
                      <Link href="/mahasiswa/schedule">
                        Lihat Jadwal
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Next Phase Requirements */}
          {mergedStats?.next_phase_requirements && (
            <Card>
              <CardHeader
                className="hover:bg-muted/50 cursor-pointer rounded-t-lg pb-2 transition-colors"
                onClick={toggleRequirements}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <AlertCircle className="h-4 w-4" />
                    Menuju Fase:{" "}
                    {PHASE_LABELS[
                      mergedStats.next_phase_requirements.next_phase
                    ] || mergedStats.next_phase_requirements.next_phase}
                  </CardTitle>
                  {showRequirements ? (
                    <ChevronUp className="text-muted-foreground h-4 w-4" />
                  ) : (
                    <ChevronDown className="text-muted-foreground h-4 w-4" />
                  )}
                </div>
              </CardHeader>
              {showRequirements && (
                <CardContent>
                  {isWorkflowLoading ? (
                    <div className="flex justify-center py-6">
                      <div className="border-primary h-6 w-6 animate-spin rounded-full border-b-2" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Documents */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="flex items-center gap-1.5 text-sm font-medium">
                            <FileCheck className="text-muted-foreground h-4 w-4" />
                            Dokumen
                          </p>
                          <Badge
                            variant={
                              mergedStats.next_phase_requirements.documents
                                .completed
                                ? "default"
                                : "secondary"
                            }
                            className={cn(
                              "text-xs",
                              mergedStats.next_phase_requirements.documents
                                .completed &&
                                "bg-emerald-500 hover:bg-emerald-500"
                            )}
                          >
                            {
                              mergedStats.next_phase_requirements.documents
                                .approved_count
                            }
                            /
                            {
                              mergedStats.next_phase_requirements.documents
                                .total_required
                            }
                          </Badge>
                        </div>
                        {!mergedStats.next_phase_requirements.documents
                          .completed &&
                          mergedStats.next_phase_requirements.documents
                            .pending_types.length > 0 && (
                            <p className="text-muted-foreground pl-6 text-xs">
                              Menunggu:{" "}
                              {mergedStats.next_phase_requirements.documents.pending_types.join(
                                ", "
                              )}
                            </p>
                          )}
                      </div>

                      {/* SEMPRO specific */}
                      {mergedStats.next_phase_requirements.seminar_schedule && (
                        <div className="space-y-2 border-t pt-4">
                          {!mergedStats.next_phase_requirements.seminar_schedule
                            .exists ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                              <p className="font-medium">
                                SEMPRO Belum Terjadwal
                              </p>
                              <p className="mt-0.5 text-amber-700">
                                Hubungi admin untuk menjadwalkan SEMPRO
                              </p>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="text-muted-foreground h-4 w-4" />
                                <span>
                                  {new Date(
                                    mergedStats.next_phase_requirements
                                      .seminar_schedule.date!
                                  ).toLocaleDateString("id-ID", {
                                    weekday: "long",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })}
                                </span>
                              </div>

                              {mergedStats.next_phase_requirements
                                .seminar_schedule.examiner_evaluations && (
                                <div className="space-y-1 pl-6">
                                  <p className="text-xs font-medium">
                                    Evaluasi Penguji
                                  </p>
                                  <p className="text-muted-foreground text-xs">
                                    {
                                      mergedStats.next_phase_requirements
                                        .seminar_schedule.examiner_evaluations
                                        .submitted
                                    }
                                    /
                                    {
                                      mergedStats.next_phase_requirements
                                        .seminar_schedule.examiner_evaluations
                                        .total
                                    }{" "}
                                    terkumpul
                                  </p>
                                </div>
                              )}

                              {mergedStats.next_phase_requirements
                                .seminar_schedule.supervisor_bimbingan && (
                                <div className="space-y-1 pl-6">
                                  <p className="text-xs font-medium">
                                    Bimbingan Pembimbing
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {mergedStats.next_phase_requirements.seminar_schedule.supervisor_bimbingan.supervisors.map(
                                      (sup: SupervisorInEvaluation) => (
                                        <Badge
                                          key={sup.id}
                                          variant={
                                            sup.status === "completed"
                                              ? "default"
                                              : "outline"
                                          }
                                          className={cn(
                                            "text-[11px]",
                                            sup.status === "completed" &&
                                              "bg-emerald-500 hover:bg-emerald-500"
                                          )}
                                        >
                                          {sup.name}: {sup.submitted_components}
                                          /{sup.total_components}
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {/* Supervisor Evaluations */}
                      {mergedStats.next_phase_requirements
                        .supervisor_evaluations &&
                        mergedStats.next_phase_requirements
                          .supervisor_evaluations.length > 0 && (
                          <div className="space-y-2 border-t pt-4">
                            <p className="flex items-center gap-1.5 text-sm font-medium">
                              <Users className="text-muted-foreground h-4 w-4" />
                              Evaluasi Pembimbing
                            </p>
                            {mergedStats.next_phase_requirements.supervisor_evaluations.map(
                              (evalStatus: EvaluationWithSupervisors) => (
                                <div
                                  key={evalStatus.evaluation_type}
                                  className="space-y-1 pl-6"
                                >
                                  <p className="text-xs font-medium">
                                    {evalStatus.evaluation_type}
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {evalStatus.supervisors.map(
                                      (sup: SupervisorInEvaluation) => (
                                        <Badge
                                          key={sup.id}
                                          variant={
                                            sup.status === "completed"
                                              ? "default"
                                              : "outline"
                                          }
                                          className={cn(
                                            "text-[11px]",
                                            sup.status === "completed" &&
                                              "bg-emerald-500 hover:bg-emerald-500"
                                          )}
                                        >
                                          {sup.name}: {sup.submitted_components}
                                          /{sup.total_components}
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        )}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {/* Final TA Readiness Gate */}
          {mergedStats?.final_ready_for_ta_individual && (
            <Card
              className={cn(
                mergedStats.final_ready_for_ta_individual.ready &&
                  "border-emerald-300 bg-emerald-50/60"
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  {mergedStats.final_ready_for_ta_individual.ready ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Lock className="text-muted-foreground h-4 w-4" />
                  )}
                  Kesiapan TA Individu
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {/* Expo Documents */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <FileCheck className="text-muted-foreground h-3.5 w-3.5" />
                      Dokumen Expo
                    </span>
                    {mergedStats.final_ready_for_ta_individual.expo_documents
                      .completed ? (
                      <Badge
                        variant="default"
                        className="h-5 bg-emerald-500 text-[10px] hover:bg-emerald-500"
                      >
                        Selesai
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {
                          mergedStats.final_ready_for_ta_individual
                            .expo_documents.approved_count
                        }
                        /
                        {
                          mergedStats.final_ready_for_ta_individual
                            .expo_documents.total_required
                        }
                      </span>
                    )}
                  </div>

                  {/* Evaluations */}
                  {(
                    ["nilai_dosen", "milestone", "expo_evaluation"] as Array<
                      "nilai_dosen" | "milestone" | "expo_evaluation"
                    >
                  ).map((key) => {
                    const status =
                      mergedStats.final_ready_for_ta_individual![key];
                    if (!isFinalReadyEvaluationSection(status)) return null;
                    if (!status?.configured) return null;
                    const labels: Record<string, string> = {
                      nilai_dosen: "Nilai Dosen",
                      milestone: "Milestone",
                      expo_evaluation: "Evaluasi Expo",
                    };
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="flex items-center gap-1.5">
                          <Mic className="text-muted-foreground h-3.5 w-3.5" />
                          {labels[key]}
                        </span>
                        {status.completed ? (
                          <Badge
                            variant="default"
                            className="h-5 bg-emerald-500 text-[10px] hover:bg-emerald-500"
                          >
                            Selesai
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {status.supervisors?.filter(
                              (s) => s.status === "completed"
                            ).length || 0}
                            /{status.supervisors?.length || 0}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Peer Review */}
                  {mergedStats.final_ready_for_ta_individual.peer_review
                    .configured && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5">
                        <Users className="text-muted-foreground h-3.5 w-3.5" />
                        Peer Review
                      </span>
                      {mergedStats.final_ready_for_ta_individual.peer_review
                        .completed ? (
                        <Badge
                          variant="default"
                          className="h-5 bg-emerald-500 text-[10px] hover:bg-emerald-500"
                        >
                          Selesai
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {
                            mergedStats.final_ready_for_ta_individual
                              .peer_review.completed_members
                          }
                          /
                          {
                            mergedStats.final_ready_for_ta_individual
                              .peer_review.total_members
                          }{" "}
                          anggota
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
