export interface DocumentType {
    id: number;
    name: string;
    description: string | null;
    phase: string | null;
    is_active: boolean;
}

export type { DocumentTypeFormData } from "@/lib/validations/document-type";
