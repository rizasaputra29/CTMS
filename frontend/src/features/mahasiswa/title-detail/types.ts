export interface TitleDetail {
    id: number;
    title: string;
    description: string;
    problem_statement: string | null;
    scope: string | null;
    specializations: string[] | null;
    quota: number;
    status: string;
    lecturer?: { id: number; name: string; email: string };
    groups?: { id: number; status: string; members: { id: number; student_id: number; is_leader: boolean; student: { id: number; name: string; email: string } }[] }[];
}

export interface Group {
    id: number;
    title_id: number | null;
    status: string;
    members: { id: number; student_id: number; is_leader: boolean }[];
}
