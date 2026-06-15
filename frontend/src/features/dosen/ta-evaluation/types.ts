export interface AssessmentComponent {
    id: number;
    name: string;
    code: string;
    description: string;
    weight: number;
}

export interface Student {
    id: number;
    name: string;
    nim: string;
}

export interface TaDefenseSchedule {
    id: number;
    student: Student;
    group: { id: number; name: string; code: string };
    date: string;
    start_time: string;
    end_time: string;
    room: string | null;
    status: string;
    evaluation_deadline: string;
}

export interface ExistingScoreValue {
    score?: string | number;
    notes?: string;
}

export interface EvaluationContext {
    schedule: TaDefenseSchedule;
    components: AssessmentComponent[];
    existing_scores: Record<string, ExistingScoreValue>;
}

export interface ScorePayload {
    student_id: number;
    group_id: number;
    evaluation_type: 'TA_DEFENSE';
    scores: {
        period_component_id: number;
        student_id: number;
        score: number;
        notes: string;
    }[];
}
