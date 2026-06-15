export interface BimbinganDocument {
    id: number;
    phase: string;
    file_path: string;
    version: number;
    document_type?: string;
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    feedback: string | null;
    created_at: string;
    student: {
        name: string;
    } | null;
    group: {
        id: number;
        title: {
            title: string;
        } | null;
    } | null;
}

export interface BimbinganGroup {
    id: number;
    code?: string;
    title: {
        title: string;
    };
    members: {
        student: {
            name: string;
        };
    }[];
    dosbing_1_name: string | null;
    dosbing_2_name: string | null;
    is_dosbing_1: boolean;
    is_dosbing_2: boolean;
}

export interface BimbinganPeriod {
    id: number;
    name: string;
    is_active: boolean;
}
