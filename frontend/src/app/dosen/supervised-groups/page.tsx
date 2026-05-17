'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, BookOpen } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Document {
    id: number;
    phase: string;
    status: string;
    version: number;
    updated_at: string;
}

interface Group {
    id: number;
    code?: string;
    status: string;
    period: { name: string };
    members: { student: { name: string } }[];
    title: { title: string } | null;
    supervisors: { role: string; lecturer: { name: string } }[];
    documents?: Document[];
    dosbing_1_name: string | null;
    dosbing_2_name: string | null;
    is_dosbing_1: boolean;
    is_dosbing_2: boolean;
}

export default function DosenSupervisedGroupsPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [groupsLoading, setGroupsLoading] = useState(true);
    const [periods, setPeriods] = useState<{ id: number; name: string; is_active: boolean }[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async (periodId?: string) => {
        if (periodId) setRefreshing(true);
        else setGroupsLoading(true);

        try {
            // Fetch periods if not already fetched
            if (periods.length === 0) {
                const periodsRes = await api.get('/periods-list');
                setPeriods(periodsRes.data?.data || []);
            }

            const url = periodId && periodId !== 'all' 
                ? `/dosen/groups/supervised?period_id=${periodId}` 
                : '/dosen/groups/supervised';
            
            const res = await api.get(url);
            setGroups(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch supervised groups', err);
        } finally {
            setGroupsLoading(false);
            setRefreshing(false);
        }
    }, [periods.length]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handlePeriodChange = (val: string) => {
        setSelectedPeriod(val);
        fetchData(val);
    };

    const statusProgress: Record<string, number> = {
        'FORMING': 0, 'FORMING_SOLO': 0, 'READY_FOR_BIDDING': 10,
        'KELOMPOK_FINAL': 20, 'PDC1_ACTIVE': 30, 'READY_FOR_SEMPRO': 40,
        'SEMPRO_DONE': 50, 'PDC2_ACTIVE': 60, 'PDC2_READY_FOR_EXPO': 70,
        'EXPO_REGISTERED': 80, 'EXPO_DONE': 90, 'READY_FOR_TA_INDIVIDUAL': 100, 'CLOSED': 100
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Supervised Groups</h1>
                    <p className="text-muted-foreground">Monitor the progress of your supervised groups.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="All Periods" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectLabel>Academic Period</SelectLabel>
                                <SelectItem value="all">All Periods</SelectItem>
                                {periods.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()}>
                                        {p.name} {p.is_active && "(Active)"}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    {refreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
            </div>

            {groupsLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : groups.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <h2 className="text-xl font-bold mb-2">No Groups</h2>
                    <p className="text-muted-foreground">You are not currently supervising any groups.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {groups.map((group) => {
                        const progress = statusProgress[group.status] || 0;
                        const latestDoc = group.documents?.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];

                        return (
                            <Card key={group.id}>
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-lg">{group.code || `Group ${group.id}`}</CardTitle>
                                            {group.is_dosbing_1 && (
                                                <Badge className="bg-blue-500">Dosbing 1</Badge>
                                            )}
                                            {group.is_dosbing_2 && (
                                                <Badge className="bg-green-500">Dosbing 2</Badge>
                                            )}
                                        </div>
                                        <Badge variant={progress === 100 ? 'default' : 'secondary'}>
                                            {group.status}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                     <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="text-sm font-medium">Period</p>
                                            <Badge variant="outline" className="text-xs">
                                                {group.period?.name || 'Unknown Period'}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-sm font-medium mb-1">Title</p>
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {group.title?.title || 'No title set'}
                                        </p>
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-1 text-sm font-medium mb-1">
                                            <Users className="h-4 w-4" /> Members
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {group.members.map(m => m.student.name).join(', ')}
                                        </p>
                                    </div>

                                    {latestDoc && (
                                        <div className="p-3 bg-muted/50 rounded-lg text-sm">
                                            <p className="font-medium text-xs text-muted-foreground uppercase mb-1">Latest Activity</p>
                                            <div className="flex justify-between items-center">
                                                <span>{latestDoc.phase} (v{latestDoc.version})</span>
                                                <Badge variant={latestDoc.status === 'APPROVED' ? 'default' : latestDoc.status === 'REJECTED' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0">
                                                    {latestDoc.status}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {formatDistanceToNow(new Date(latestDoc.updated_at), { addSuffix: true, locale: localeId })}
                                            </p>
                                        </div>
                                    )}

                                    <div className="pt-2 border-t">
                                        <div className="flex justify-between text-xs font-medium mb-1.5">
                                            <span>Overall Progress</span>
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
                        );
                    })}
                </div>
            )}
        </div>
    );
}
