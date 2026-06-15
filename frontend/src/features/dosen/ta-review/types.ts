export interface TaSubmission {
    id: number;
    student_id: number;
    group_id: number;
    status: string;
    file_path: string | null;
    feedback: string | null;
    student: { name: string; email: string } | null;
    group: {
        title: { title: string } | null;
    } | null;
}

export interface PeriodOption {
    id: number;
    name: string;
    is_active: boolean;
}
