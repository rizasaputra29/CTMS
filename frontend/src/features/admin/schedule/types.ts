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

export interface ApiSchedule {
    id: number;
    group_id: number;
    type: string;
    date: string;
    start_time?: string;
    end_time?: string;
    room: string | null;
    status: string;
    mode?: string;
    notes?: string;
    examiner1?: Dosen;
    examiner2?: Dosen;
    requested_by?: number;
    rejection_reason?: string;
    online_link?: string;
    group: {
        id: number;
        title?: { title: string };
        period?: { id: number; name: string };
        supervisor?: Dosen;
    };
    evaluations: { id: number; examiner: Dosen; status: string; score: number | null }[];
}

export interface ApiTaDefenseSchedule {
    id: number;
    student: { id: number; name: string };
    students?: { id: number; name: string; nim?: string; email?: string }[];
    group: { id: number; title?: { title: string }; period?: { id: number; name: string } };
    period?: { id: number; name: string };
    date: string;
    start_time: string;
    end_time: string;
    room: string | null;
    status: string;
    examiner1?: Dosen;
    examiner2?: Dosen;
    evaluations: { id: number; examiner: Dosen; status: string; score: number | null }[];
}

export type ScheduleView = 'calendar' | 'table';
