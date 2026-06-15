export interface TitleDetail {
    id: number;
    title: string;
    description: string;
    problem_statement: string | null;
    scope: string | null;
    specializations: string[] | null;
    quota: number;
    status: string;
    title_source: string | null;
    lecturer?: { id: number; name: string; email: string };
    groups?: {
        id: number;
        code?: string;
        status: string;
        members: {
            id: number;
            student_id: number;
            is_leader: boolean;
            student: { id: number; name: string; email: string };
        }[];
    }[];
}
