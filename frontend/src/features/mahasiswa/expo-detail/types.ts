export interface Component {
    id: number;
    code: string;
    name: string;
    description: string | null;
    weight: number;
}

export interface MyScore {
    period_component_id: number;
    code: string;
    name: string;
    weight: number;
    score: number | null;
    notes: string | null;
}

export interface Member {
    id: number;
    name: string;
    nim: string;
    is_leader: boolean;
    has_submitted_evaluation: boolean;
    has_uploaded_document: boolean;
    document_status: string | null;
}

export interface MyDocument {
    id: number;
    original_name: string;
    status: string;
}

export interface ExpoDetail {
    expo_event: {
        id: number;
        name: string;
        date: string;
        start_time: string;
        end_time: string;
        room: string;
    };
    registration: { id: number; status: string };
    group: { id: number; name: string; code: string };
    members: Member[];
    components: Component[];
    my_scores: MyScore[];
    my_document: MyDocument | null;
}
