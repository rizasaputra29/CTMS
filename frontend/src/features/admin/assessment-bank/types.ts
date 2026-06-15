export interface AssessmentTemplate {
  id: number;
  code: string;
  name: string;
  description: string | null;
  weight: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
