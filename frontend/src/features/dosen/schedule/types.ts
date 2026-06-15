export interface DosenScheduleGroup {
    id: number;
    title: {
        title: string;
    } | null;
    members: {
        student: {
            name: string;
        };
    }[];
}

export interface DosenScheduleLocation {
    id: number;
    name: string;
    type: 'offline' | 'online';
    capacity: number | null;
    is_active: boolean;
}

export interface DosenScheduleEvent {
    id: number | string;
    group_id: number;
    student_id?: number;
    type: 'SEMPRO' | 'SIDANG' | 'EXPO' | 'BIMBINGAN' | 'TA_DEFENSE';
    date: string;
    start_time?: string;
    end_time?: string;
    room: string;
    mode?: string | null;
    notes?: string | null;
    status?: string;
    period_name?: string;
    student_name?: string;
    examiner1?: { name: string } | null;
    examiner2?: { name: string } | null;
    examiners?: { name: string; role?: string }[];
    group: {
        title: {
            title: string;
            lecturer?: { name: string } | null;
        } | null;
        members?: { student: { name: string } }[];
        supervisor?: { name: string } | null;
    };
}

export interface DosenSchedulePeriod {
    id: number;
    name: string;
    is_active: boolean;
}
