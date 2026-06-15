export interface Document {
    id: number;
    phase: string;
    status: string;
    version: number;
    updated_at: string;
}

export interface Group {
    id: number;
    code?: string;
    status: string;
    period: { name: string };
    members: { student: { name: string } }[];
    title: { title: string } | null;
    supervisors: { role: string; lecturer: { name: string } }[];
    documents?: Document[];
    dosbing_1_name: string | null;
    dosbing_2_name: string | null;
    is_dosbing_1: boolean;
    is_dosbing_2: boolean;
}

export interface PeriodOption {
    id: number;
    name: string;
    is_active: boolean;
}
