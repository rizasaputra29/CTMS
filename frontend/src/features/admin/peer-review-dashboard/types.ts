export interface PeerReviewGroupMember {
    student_id: number;
    student_name: string;
    student_nim: string;
    has_completed: boolean;
    ta_status: string;
}

export interface PeerReviewGroupProgress {
    group_id: number;
    group_name: string;
    group_code: string;
    period_name: string;
    total_members: number;
    completed_count: number;
    completion_percentage: number;
    members: PeerReviewGroupMember[];
}
