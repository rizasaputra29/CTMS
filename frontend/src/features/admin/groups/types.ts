export interface GroupMember {
  id: number;
  student: {
    name: string;
    nim: string;
    email?: string;
  };
  is_leader: boolean;
  joined_at?: string;
}

export interface Group {
  id: number;
  status: string;
  group_mode: string;
  period_id: number;
  period: { name: string };
  title: { title: string } | null;
  members: GroupMember[];
  supervisions: { supervisor: { name: string } }[];
  status_label?: string;
  allowed_actions?: {
    can_manage_finalization: boolean;
    reason: string | null;
  };
}

export interface PeriodOption {
  id: number;
  name: string;
  is_active: boolean;
}

export interface PaginationData {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export type SortKey = "leader" | "period" | "title" | "status";
export type SortDir = "asc" | "desc";
