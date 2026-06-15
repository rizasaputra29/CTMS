

export interface EvaluationDetailFeatureProps {
    evaluationId: number;
    evaluationType?: string;
    scheduleId?: number;
}

export interface AssessmentComponent {
    id: number
    name: string
    code: string
    description: string
    weight: number
}

export interface Student {
    id: number
    name: string
    nim: string
}

export interface Group {
    id: number
    code?: string
    period_id: number
    members?: { student: Student }[]
    title?: { name: string; title?: string }
}

export interface Schedule {
    id: number
    type: string
    date: string
    start_time: string
    end_time: string
    room?: string
}

export interface Evaluation {
    id: number
    status: 'PENDING' | 'COMPLETED' | 'SUBMITTED'
}

export interface EvaluationContext {
    evaluation: Evaluation;
    schedule: Schedule;
    group: Group;
    components: AssessmentComponent[];
    existing_scores: Record<string, { score: string; notes?: string }>;
    type: 'SEMINAR' | 'TA_DEFENSE';
    // For TA Defense - single student
    student?: Student | null;
}
