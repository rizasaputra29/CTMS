export interface AuditLogUser {
    id: number;
    name: string;
    email: string;
}

export interface AuditLog {
    id: number;
    action: string;
    target_type: string;
    target_id: number;
    payload: Record<string, unknown> | null;
    created_at: string;
    user: AuditLogUser | null;
    period_name?: string;
}

export interface AuditLogPeriod {
    id: number;
    name: string;
    is_active: boolean;
}

export interface AuditLogPagination {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}
