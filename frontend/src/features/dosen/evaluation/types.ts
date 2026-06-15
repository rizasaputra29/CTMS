export interface DosenEvaluationGroup {
    id: number;
    code?: string;
    title?: { title?: string; name?: string };
    members?: { student: { id: number; name: string; nim?: string } }[];
}

export interface DosenEvaluationStudent {
    id: number;
    name: string;
    nim?: string;
}

export interface DosenEvaluation {
    id: number;
    type: 'SEMINAR' | 'TA_DEFENSE';
    schedule_type: string;
    schedule_id: number;
    date: string;
    start_time: string;
    end_time: string;
    room: string;
    status: 'PENDING' | 'COMPLETED' | 'SUBMITTED';
    points: number;
    notes: string;
    deadline: string | null;
    updated_at?: string;
    group: DosenEvaluationGroup;
    student?: DosenEvaluationStudent | null;
}

export interface DosenEvaluationSeminarData {
    id: number;
    type: string;
    date: string;
    start_time: string;
    end_time: string;
    room: string;
    evaluation_deadline?: string;
    evaluations?: {
        id: number;
        status: string;
        score: number;
        feedback?: string;
        updated_at?: string;
        student_id?: number;
    }[];
    group: DosenEvaluationGroup;
    student?: DosenEvaluationStudent;
    students?: DosenEvaluationStudent[];
}

export interface DosenEvaluationPeriod {
    id: number;
    name: string;
    is_active: boolean;
}
