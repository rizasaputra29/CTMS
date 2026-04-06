'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
    Users, Search, Filter, 
    ChevronRight, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import Link from 'next/link';

interface Group {
    id: number;
    status: string;
    group_mode: string;
    period_id: number;
    period: { name: string };
    title: { title: string } | null;
    members: { id: number; student: { name: string; nim: string }; is_leader: boolean }[];
    supervisions: { supervisor: { name: string } }[];
}

export default function AdminGroupsPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [periods, setPeriods] = useState<{ id: number; name: string; is_active: boolean }[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch periods
            const periodsRes = await api.get('/periods-list');
            setPeriods(periodsRes.data);

            // Fetch groups
            const url = selectedPeriod !== 'all' ? `/admin/groups?period_id=${selectedPeriod}` : '/admin/groups';
            const groupsRes = await api.get(url);
            setGroups(groupsRes.data.data || []);
        } catch (error) {
            console.error('Failed to fetch groups data', error);
        } finally {
            setLoading(false);
        }
    }, [selectedPeriod]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredGroups = groups.filter(group => {
        const matchesSearch = 
            group.members.some(m => m.student.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (group.title?.title.toLowerCase().includes(searchQuery.toLowerCase()) || false);
        return matchesSearch;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED': return <Badge className="bg-green-500">Approved</Badge>;
            case 'READY_FOR_BIDDING': return <Badge variant="secondary">Bidding</Badge>;
            case 'FORMING': return <Badge variant="outline">Forming</Badge>;
            case 'REJECTED': return <Badge variant="destructive">Rejected</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Group Management</h1>
                    <p className="text-muted-foreground text-sm">Monitor all student groups across registration periods.</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by student name or project title..." 
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="All Periods" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectLabel>Registration Period</SelectLabel>
                                <SelectItem value="all">All Periods</SelectItem>
                                {periods.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()}>
                                        {p.name} {p.is_active && "(Active)"}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card>
                <CardHeader className="pb-3 text-sm font-medium border-b bg-muted/30">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>Total Groups: {filteredGroups.length}</span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : filteredGroups.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground">
                            No groups found for the selected criteria.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Group Members</TableHead>
                                    <TableHead>Period</TableHead>
                                    <TableHead>Project Title</TableHead>
                                    <TableHead>Supervisor(s)</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredGroups.map((group) => (
                                    <TableRow key={group.id}>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                {group.members
                                                    .filter(m => m.is_leader || (searchQuery !== '' && m.student.name.toLowerCase().includes(searchQuery.toLowerCase())))
                                                    .map(m => (
                                                        <div key={m.id} className="text-sm">
                                                            <span className="font-medium">{m.student.name}</span>
                                                            <span className="text-xs text-muted-foreground ml-2">({m.student.nim})</span>
                                                            {m.is_leader && <Badge variant="outline" className="ml-2 text-[10px] h-4">Leader</Badge>}
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-xs font-medium">{group.period.name}</div>
                                        </TableCell>
                                        <TableCell className="max-w-[250px]">
                                            <div className="text-sm font-medium line-clamp-2" title={group.title?.title || 'No title assigned'}>
                                                {group.title?.title || <span className="text-muted-foreground italic">No title assigned</span>}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground uppercase mt-1">{group.group_mode}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-0.5">
                                                {group.supervisions.length > 0 ? group.supervisions.map((s, idx) => (
                                                    <div key={idx} className="text-xs font-medium">S{idx+1}: {s.supervisor.name}</div>
                                                )) : <span className="text-xs text-muted-foreground">Not assigned</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(group.status)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link href={`/admin/finalization?group_id=${group.id}`}>
                                                    Manage <ChevronRight className="ml-1 h-3 w-3" />
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
