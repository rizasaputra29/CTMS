export interface Group {
    id: number;
    status: string;
    status_label?: string;
    assignment_type: string | null;
    title_id: number | null;
    is_solo?: boolean;
    allowed_actions?: {
        can_add_member: boolean;
        can_remove_member: boolean;
        can_leave_group: boolean;
        can_delete_group: boolean;
        can_mark_ready_for_finalization: boolean;
        can_cancel_ready_for_finalization: boolean;
    };
    period?: {
        min_group_size: number;
        max_group_size: number;
    };
    title: {
        id: number;
        title: string;
        quota: number;
        lecturer: {
             name: string;
        }
    } | null;
    members: {
        id: number;
        student: {
            id: number;
            name: string;
            email: string;
        };
        is_leader: boolean;
    }[];
}

export interface JoinRequest {
    id: number;
    status: string;
    message: string | null;
    requester: {
        id: number;
        name: string;
        email: string;
    };
}

export interface NotificationItem {
    type: string;
    message: string;
    is_read?: boolean;
}
