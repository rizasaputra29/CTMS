export interface AssessmentPeriod {
    id: number;
    name: string;
    is_active: boolean;
}

export interface AssessmentComponent {
    id: number;
    code: string;
    name: string;
    description: string | null;
    weight: number;
    type: string;
    sort_order: number;
    template_id: number;
    period_id: number;
}
