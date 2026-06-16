import type { TitleApprovalHistoryItem, TitleDeletionHistoryItem } from '@/types/title';

export interface Title {
    id: number;
    title: string;
    description: string;
    problem_statement: string | null;
    scope: string | null;
    specializations: string[] | null;
    quota: number;
    status: 'open' | 'closed' | 'APPROVED' | 'PENDING';
    active_groups_count: number;
    lecturer_id: number;
    pre_assigned_group_id?: number | null;
    title_source?: string;
    supervisor_approval_status?: string;
}

export interface GroupSummary {
    id: number;
    status: string;
    period_id?: number;
    members: Array<{ id: number; name?: string }>;
}

export type SortKey = 'title' | 'quota' | 'status' | 'active_groups_count';
export type SortDir = 'asc' | 'desc';

export interface TitleFormDialogState {
    open: boolean;
    editingId: number | null;
}

export interface WithdrawDialogState {
    open: boolean;
    title?: Title;
    reason: string;
    loading: boolean;
}

export interface HistoryDialogState {
    open: boolean;
    title: Title | undefined;
    loading: boolean;
    approvalHistory: TitleApprovalHistoryItem[];
    deletionHistory: TitleDeletionHistoryItem[];
}
