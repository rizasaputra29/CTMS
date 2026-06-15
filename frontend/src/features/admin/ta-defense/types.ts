export interface Period {
    id: number;
    name: string;
    is_active: boolean;
}

export interface Dosen {
    id: number;
    name: string;
    email: string;
}

export interface Student {
    id: number;
    name: string;
    nim: string;
}

export interface Location {
    id: number;
    name: string;
    capacity: number;
    type: 'physical' | 'online';
    is_active: boolean;
}

export interface TaDefenseSchedule {
    id: number;
    student?: Student;
    students?: Student[];
    group: { id: number; name: string; code: string };
    period: Period;
    date: string;
    start_time: string;
    end_time: string;
    room: string | null;
    location_id?: number;
    status: 'SCHEDULED' | 'DONE' | 'CANCELLED';
    examiner1: Dosen;
    examiner2: Dosen;
    evaluation_deadline: string;
    notes: string | null;
}

export interface EligibleMember {
    student: Student;
    is_leader: boolean;
    is_ready_for_sidang: boolean;
    is_already_selected: boolean;
    status_text: string;
    has_active_defense: boolean;
}

export interface EligibleStudentData {
    id: number;
    name: string;
    code: string;
    members: EligibleMember[];
    supervisors: { id: number; pivot?: { role: string } }[];
}

export type SortKey = 'name' | 'date' | 'status';
export type SortDir = 'asc' | 'desc';
export type StatusFilter = 'ALL' | 'SCHEDULED' | 'DONE' | 'CANCELLED';

export interface TaDefenseFormDialogState {
    open: boolean;
    mode: 'create' | 'edit';
    editingId: number | null;
}
