export interface Lecturer {
  id: number;
  name: string;
  email: string;
}

export interface Proposal {
  id: number;
  title: string;
  description: string;
  problem_statement: string;
  scope: string;
  specializations: string[] | null;
  supervisor_approval_status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  rejection_reason: string | null;
  proposed_supervisor: {
    id: number;
    name: string;
    email: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface GroupInfo {
  id: number;
  status: string;
  has_active_proposal?: boolean;
  is_solo?: boolean;
  title_id: number | null;
  title: { title: string } | null;
  members: { id: number; student: { id: number }; is_leader: boolean }[];
}

export interface ProposalFlow {
  can_create_proposal: boolean;
  can_update_rejected_proposal: boolean;
  can_cancel_pending_proposal: boolean;
  reason: string | null;
}
