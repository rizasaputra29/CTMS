export interface Bid {
    id: number;
    group_id: number;
    priority: number;
    status: string;
    lecturer_recommendation: string | null;
    title: { id: number; title: string };
    group: {
        id: number;
        members: { id: number; student: { name: string; email: string }; is_leader: boolean }[];
    };
    allowed_actions?: {
        can_accept: boolean;
        can_reject: boolean;
        can_cancel_accept: boolean;
        reason: string | null;
    };
}

export interface LecturerBidsFlow {
    can_recommend_bid: boolean;
    reason: string | null;
}

export interface PeriodOption {
    id: number;
    name: string;
    is_active: boolean;
}
