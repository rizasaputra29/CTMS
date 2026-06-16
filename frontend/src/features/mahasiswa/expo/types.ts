export interface ExpoEvent {
    id: number;
    name: string;
    date: string;
    start_time: string;
    end_time: string;
    room: string;
    capacity: number;
    registrations_count: number;
    is_registered: boolean;
}
