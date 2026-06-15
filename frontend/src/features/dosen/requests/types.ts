export interface Group {
    id: number;
    code?: string;
    title: {
        title: string;
        quota: number;
    };
    members: {
        id: number;
        student: {
            id: number;
            name: string;
            email: string;
        };
        is_leader: boolean;
    }[];
    status: string;
    created_at: string;
}

export type SortKey = 'title' | 'members' | 'status' | 'date';
export type SortDir = 'asc' | 'desc';
