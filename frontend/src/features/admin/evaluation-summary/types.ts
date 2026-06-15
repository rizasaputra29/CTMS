export interface Student {
    id: number;
    name: string;
    nim: string;
}

export interface Evaluator {
    id: number;
    name: string;
    role: string;
}

export interface Score {
    component: string;
    score: number;
    weight: number;
}

export interface EvaluatorData {
    evaluator: Evaluator;
    weighted_average: number;
    scores: Score[];
}

export interface StudentScores {
    student: Student;
    scores: Record<string, EvaluatorData[]>;
}

export interface Schedule {
    id: number;
    type: string;
    date: string;
    room: string;
}

export interface Group {
    id: number;
    name: string;
    code: string;
}

export interface EvaluationSummaryData {
    schedule: Schedule;
    group: Group;
    summary: StudentScores[];
}
