export interface Period {
  id: number;
  name: string;
  is_active: boolean;
}

export interface SupervisedGroup {
  id: number;
  code?: string;
  status?: string;
  period?: { name?: string };
}

export interface DashboardResponse {
  active_groups?: number;
  pending_proposals?: number;
  available_periods?: Period[];
}

export interface SupervisedResponse {
  data?: SupervisedGroup[];
}

export interface EvalCountResponse {
  count?: number;
}

export interface DosenDashboardData {
  supervisedGroups: number;
  pendingEvaluations: number;
  pendingProposals: number;
  availablePeriods: number;
  periods: Period[];
  recentSubmissions: {
    id: number;
    label: string;
    subtitle: string;
    status: { label: string; variant: "outline" };
    href: string;
  }[];
}
