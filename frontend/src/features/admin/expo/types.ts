export interface ExpoEvent {
    id: number;
    period_id: number;
    name: string;
    date: string;
    start_time: string;
    end_time: string;
    room: string;
    location_id?: number;
    capacity: number;
    is_published: boolean;
    registrations_count: number;
    period?: { id: number; name: string };
    creator?: { name: string };
}

export interface Period {
    id: number;
    name: string;
    is_active: boolean;
}

export interface Location {
    id: number;
    name: string;
    capacity: number;
    type: 'physical' | 'online';
    is_active: boolean;
}
