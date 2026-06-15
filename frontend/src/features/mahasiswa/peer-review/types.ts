export interface GroupMember {
  id: number;
  student: { id: number; name: string; email: string; nim?: string };
  is_leader: boolean;
}

export interface Indicator {
  id: number;
  code: string;
  name: string;
  description: string | null;
  weight: number;
}

export interface ExistingReview {
  reviewee_id: number;
  period_indicator_id: number;
  score: number;
  raw_score: number;
  comment: string | null;
}
