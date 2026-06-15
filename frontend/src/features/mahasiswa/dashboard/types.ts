import type { Group } from "@/types/group";
import type { MahasiswaStats, WorkflowData } from "@/types/dashboard";

export interface MiniCalendarEvent {
  id: number | string;
  date: string;
  title: string;
  type: string;
}

export interface MahasiswaDashboardData {
  stats: MahasiswaStats | null;
  group: Group | null;
  schedules: MiniCalendarEvent[];
  workflow: WorkflowData | null;
}

export type { Group, MahasiswaStats, WorkflowData };
