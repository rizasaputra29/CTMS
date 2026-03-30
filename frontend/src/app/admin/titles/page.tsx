'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, BookOpen, Users } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface Period {
    id: number;
    name: string;
    is_active: boolean;
}

interface Group {
    id: number;
    status: string;
    members: { student: { name: string } }[];
    title: { title: string } | null;
    supervisors: { lecturer: { name: string } }[];
}

export default function AdminTitlesPage() {
    const [periods, setPeriods] = useState<Period[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async (periodId?: string) => {
        setLoading(true);
        try {
            let currentPeriodId = periodId || selectedPeriod;
            if (!currentPeriodId) {
                const perRes = await api.get('/admin/periods');
                setPeriods(perRes.data || []);
                const active = (perRes.data || []).find((p: Period) => p.is_active);
                if (active) currentPeriodId = active.id.toString();
                setSelectedPeriod(currentPeriodId);
            }

            if (!currentPeriodId) {
                setLoading(false);
                return;
            }

            const res = await api.get(`/admin/groups?period_id=${currentPeriodId}`);
            setGroups(res.data || []);
        } catch (err) {
            console.error('Failed to fetch groups', err);
        } finally {
            setLoading(false);
        }
    }, [selectedPeriod]);

    useEffect(() => {
        if (!selectedPeriod) fetchData();
    }, [fetchData, selectedPeriod]);

    const handlePeriodChange = (val: string) => {
        setSelectedPeriod(val);
        fetchData(val);
    };

    if (loading && !groups.length) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    // State machine status map for progress calculation
    const statusProgress: Record<string, number> = {
        'FORMING': 0, 'READY_FOR_BIDDING': 10, 'WAITING_SUPERVISOR_APPROVAL': 15,
        'KELOMPOK_FINAL': 20, 'PDC1_ACTIVE': 30, 'READY_FOR_SEMPRO': 40,
        'SEMPRO_DONE': 50, 'PDC2_ACTIVE': 60, 'PDC2_READY_FOR_EXPO': 70,
        'EXPO_REGISTERED': 80, 'EXPO_DONE': 90, 'PDC2_COMPLETED': 100, 'CLOSED': 100
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Titles & Progress</h1>
                    <p className="text-muted-foreground">Monitor the progress of all student groups.</p>
                </div>
                <Select value={selectedPeriod} onValueChange={handlePeriodChange} disabled={loading}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                        {periods.map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {groups.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <h2 className="text-xl font-bold mb-2">No Groups</h2>
                    <p className="text-muted-foreground">There are no groups in this period yet.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {groups.map((group) => {
                        const progress = statusProgress[group.status] || 0;
                        return (
                            <Card key={group.id}>
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-base font-bold">Group #{group.id}</CardTitle>
                                        <Badge variant={progress === 100 ? 'default' : 'secondary'}>
                                            {group.status}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="text-sm">
                                        <strong className="block text-muted-foreground mb-1">Title:</strong>
                                        <span className="font-medium">{group.title?.title || 'No title assigned yet'}</span>
                                    </div>
                                    <div className="text-sm">
                                        <div className="flex items-center gap-1 text-muted-foreground mb-1">
                                            <Users className="h-3 w-3" /> <strong>Members:</strong>
                                        </div>
                                        {group.members.map(m => m.student.name).join(', ')}
                                    </div>
                                    <div className="text-sm">
                                        <strong className="block text-muted-foreground mb-1">Supervisors:</strong>
                                        {group.supervisors && group.supervisors.length > 0
                                            ? group.supervisors.map(s => s.lecturer.name).join(', ')
                                            : 'None'}
                                    </div>

                                    <div className="pt-2">
                                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                            <span>Progress</span>
                                            <span>{progress}%</span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full transition-all ${progress === 100 ? 'bg-green-500' : 'bg-primary'}`}
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    );
}
