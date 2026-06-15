export interface DocumentType {
    id: number;
    name: string;
    description: string | null;
    phase: string | null;
    is_active: boolean;
}

export interface DocumentTypeFormData {
    name: string;
    description: string;
    phase: string;
}
