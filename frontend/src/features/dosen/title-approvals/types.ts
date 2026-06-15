export interface Proposal {
    id: number;
    title: string;
    description: string;
    problem_statement: string | null;
    scope: string | null;
    supervisor_approval_status: string;
    proposed_by_group: {
        id: number;
        status: string;
        members: {
            id: number;
            is_leader: boolean;
            student: {
                id: number;
                name: string;
                email: string;
            };
        }[];
    } | null;
    proposed_supervisor: {
        id: number;
        name: string;
    } | null;
    created_at: string;
    allowed_actions?: {
        can_approve: boolean;
        can_reject: boolean;
        reason: string | null;
    };
}

export interface LecturerProposalFlow {
    can_approve_proposal: boolean;
    can_reject_proposal: boolean;
    reason: string | null;
}

export interface PeriodOption {
    id: number;
    name: string;
    is_active: boolean;
}
