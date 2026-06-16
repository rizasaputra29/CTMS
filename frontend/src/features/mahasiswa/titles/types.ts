export interface LecturerTitle {
    id: number;
    title: string;
    description: string;
    specializations: string[] | null;
    quota: number;
    status: string;
    active_groups_count: number;
    lecturer?: { id: number; name: string; email: string };
    title_source?: 'LECTURER' | 'STUDENT' | null;
}

export interface StudentIdea {
    id: number;
    title: string;
    description: string;
    specializations: string[] | null;
    proposed_supervisor: { id: number; name: string } | null;
    proposed_by_group: {
        id: number;
        status: string;
        members: { id: number; is_leader: boolean; student: { id: number; name: string; email: string } }[];
        period: { max_group_size: number } | null;
    } | null;
    title_source?: 'LECTURER' | 'STUDENT' | null;
}

export interface Group {
    id: number;
    title_id: number | null;
    status: string;
    is_solo?: boolean;
    title?: { id: number; title: string };
    members: { id: number; student_id: number; is_leader: boolean }[];
    period?: { max_group_size: number };
}

export interface BursaFlow {
    can_request_join: boolean;
    can_accept_join_requests: boolean;
    can_reject_join_requests: boolean;
    reason: string | null;
}

export interface RegisteredPeriod {
    id: number;
    name: string;
    is_active: boolean;
    is_finalized: boolean;
}
