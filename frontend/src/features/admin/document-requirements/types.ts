export interface Period {
    id: number;
    name: string;
    is_active: boolean;
    is_finalized?: boolean;
}

export interface PhaseSummary {
    phase: string;
    document_count: number;
    required_count: number;
    document_names: string[];
    has_configured: boolean;
}

export interface PhaseRequirement {
    id?: number;
    phase: string;
    name: string;
    description: string | null;
    is_required: boolean;
}
