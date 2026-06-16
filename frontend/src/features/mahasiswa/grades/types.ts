export interface EvaluatorDetail {
    name: string;
    role: string;
    score: number | null;
    component: string;
}

export interface ComponentDetail {
    score: number | null;
    evaluators: EvaluatorDetail[];
}

export interface GradeSection {
    grade: number;
    components: Record<string, ComponentDetail>;
    component_count: number;
    status: string;
}

export interface GradeData {
    pdc1: GradeSection | null;
    pdc2: GradeSection | null;
    ta: GradeSection | null;
}

export interface ApiResponse {
    grades: GradeData | null;
    group: { id: number; name: string };
    period: { id: number; name: string };
    student: { id: number; name: string; nim: string };
}
