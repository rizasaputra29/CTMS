export interface Period {
    id: number;
    name: string;
    is_active: boolean;
    is_finalized?: boolean;
}

export interface Dosen {
    id: number;
    name: string;
    email: string;
}

export interface Location {
    id: number;
    name: string;
    capacity: number;
    type: 'physical' | 'online';
    is_active: boolean;
}

export interface BimbinganEval {
    student: { id: number; name: string };
    average_score: number;
}

export interface Schedule {
    id: number;
    group_id: number;
    type: string;
    date: string;
    start_time: string;
    end_time: string;
    room: string | null;
    location_id: number | null;
    status: string;
    examiner1: Dosen;
    examiner2: Dosen;
    group: {
        id: number;
        title?: { title: string };
        supervisor1?: Dosen;
        supervisor2?: Dosen;
    };
    evaluations: { id: number; examiner: Dosen; status: string; score: number | null }[];
    bimbingan_evaluations?: BimbinganEval[];
    examiner_student_averages?: BimbinganEval[];
}

export interface GroupItem {
    id: number;
    status: string;
    period_id?: number;
    title?: { title: string };
    members: { student: { id: number; name: string } }[];
    supervisor1?: { id: number; name: string } | null;
    supervisor2?: { id: number; name: string } | null;
}

export type SortKey = 'title' | 'date' | 'status';
export type SortDir = 'asc' | 'desc';
