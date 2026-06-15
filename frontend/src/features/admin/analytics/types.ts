export interface GroupProgressPeriod {
    id: number;
    name: string;
    is_active: boolean;
}

export interface GroupProgressMember {
    id: number;
    student: {
        id: number;
        name: string;
        nim: string;
    };
}

export interface ProgressPhase {
    phase: string;
    status: 'locked' | 'unlocked' | 'draft' | 'submitted' | 'revision' | 'completed';
    documents: Array<{
        type: string;
        status: string;
    }>;
}

export interface GroupProgress {
    id: number;
    code?: string;
    name: string | null;
    status: string;
    period_id: number;
    period: GroupProgressPeriod;
    title: {
        id: number;
        title: string;
    } | null;
    supervisor1: {
        id: number;
        name: string;
    } | null;
    supervisor2: {
        id: number;
        name: string;
    } | null;
    members: GroupProgressMember[];
    members_count: number;
    progress: {
        phases: ProgressPhase[];
        current_phase: string | null;
        is_graduated: boolean;
    } | null;
    progress_percentage: number;
}

export interface GroupProgressMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}
