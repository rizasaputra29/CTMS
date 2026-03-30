'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';
import ScheduleCalendar, { type ScheduleEvent } from '@/components/schedule/ScheduleCalendar';

export default function MahasiswaSchedulePage() {
    const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSchedules = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get('/mahasiswa/schedules');
            setSchedules(response.data.data);
        } catch (error) {
            console.error('Failed to fetch schedules', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSchedules();
    }, [fetchSchedules]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">My Schedule</h1>
                <p className="text-muted-foreground">View your bimbingan sessions and upcoming academic events.</p>
            </div>

            <ScheduleCalendar schedules={schedules} />
        </div>
    );
}
