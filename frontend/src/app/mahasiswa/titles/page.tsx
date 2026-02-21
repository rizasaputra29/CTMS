'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ArrowUpDown, Search, Loader2, Info, Lock } from 'lucide-react';
import api from '@/lib/api';
import { toast } from "sonner";
import axios from 'axios';

const SPECIALIZATIONS = ['Software', 'Embedded', 'Network', 'Multimedia', 'AI', 'Blockchain'];

interface Title {
    id: number;
    title: string;
    description: string;
    specializations: string[] | null;
    quota: number;
    status: string;
    active_groups_count: number;
    lecturer?: { id: number; name: string; email: string };
}

interface Group {
    id: number;
    title_id: number | null;
    status: string;
    title?: { id: number; title: string };
    members: { id: number; student_id: number; is_leader: boolean }[];
}

type SortKey = 'title' | 'lecturer' | 'quota' | 'specializations';
type SortDir = 'asc' | 'desc';

export default function MahasiswaTitlesPage() {
    const [titles, setTitles] = useState<Title[]>([]);
    const [loading, setLoading] = useState(true);
    const [group, setGroup] = useState<Group | null>(null);
    const [biddingId, setBiddingId] = useState<number | null>(null);

    const [search, setSearch] = useState('');
    const [filterSpecs, setFilterSpecs] = useState<string[]>([]);
    const [sortKey, setSortKey] = useState<SortKey>('title');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [titlesRes, groupRes] = await Promise.all([
                    api.get('/mahasiswa/titles'),
                    api.get('/mahasiswa/group'),
                ]);
                setTitles(titlesRes.data);
                setGroup(groupRes.data?.group || groupRes.data);
            } catch (error) {
                console.error('Failed to fetch data', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const hasGroup = !!group;
    const hasTitle = !!group?.title_id;
    const isApproved = group?.status === 'APPROVED';
    const isPending = group?.status === 'PENDING';
    const isWaitingProposal = group?.status === 'WAITING_SUPERVISOR_APPROVAL';
    const canBid = hasGroup && !hasTitle && !isPending && !isWaitingProposal && group?.status === 'READY_FOR_BIDDING';

    const handleBid = async (titleId: number) => {
        if (!canBid) return;
        setBiddingId(titleId);
        try {
            await api.post('/mahasiswa/group/bid-title', { title_id: titleId });
            toast.success('Bid submitted successfully!');
            const groupRes = await api.get('/mahasiswa/group');
            setGroup(groupRes.data?.group || groupRes.data);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Failed to bid');
            } else {
                toast.error('Failed to submit bid');
            }
        } finally {
            setBiddingId(null);
        }
    };

    const toggleSpecFilter = (spec: string) => {
        setFilterSpecs(prev =>
            prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
        );
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const filteredTitles = useMemo(() => {
        let result = titles;
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(t =>
                t.title.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q) ||
                (t.lecturer?.name || '').toLowerCase().includes(q)
            );
        }
        if (filterSpecs.length > 0) {
            result = result.filter(t =>
                t.specializations && filterSpecs.some(s => t.specializations!.includes(s))
            );
        }
        result = [...result].sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'title') cmp = a.title.localeCompare(b.title);
            else if (sortKey === 'lecturer') cmp = (a.lecturer?.name || '').localeCompare(b.lecturer?.name || '');
            else if (sortKey === 'quota') cmp = (a.quota - a.active_groups_count) - (b.quota - b.active_groups_count);
            else if (sortKey === 'specializations') cmp = (a.specializations?.join(',') || '').localeCompare(b.specializations?.join(',') || '');
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return result;
    }, [titles, search, filterSpecs, sortKey, sortDir]);

    const getStatusMessage = () => {
        if (!hasGroup) return null;
        if (isApproved) return { icon: <Lock className="h-4 w-4" />, title: 'Title Approved', desc: `Your group already has an approved title: "${group?.title?.title}".` };
        if (isPending) return { icon: <Lock className="h-4 w-4" />, title: 'Bid Pending', desc: 'Your group has a pending bid. Wait for the lecturer to respond.' };
        if (isWaitingProposal) return { icon: <Lock className="h-4 w-4" />, title: 'Proposal Pending', desc: 'Your group has a pending title proposal. Cannot bid while proposal is pending.' };
        return null;
    };

    const statusMsg = getStatusMessage();

    const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
        <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort(sortKeyName)}>
            <div className="flex items-center gap-1">
                {label}
                <ArrowUpDown className="h-3 w-3 opacity-50" />
            </div>
        </TableHead>
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Available Titles</h1>
                <p className="text-muted-foreground">Browse and bid on titles offered by lecturers.</p>
            </div>

            {/* Status Alerts */}
            {!hasGroup && (
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>No Group Yet</AlertTitle>
                    <AlertDescription>
                        You must <a href="/mahasiswa/group" className="font-medium underline">create a group</a> first before you can bid for a title.
                    </AlertDescription>
                </Alert>
            )}
            {statusMsg && (
                <Alert>
                    {statusMsg.icon}
                    <AlertTitle>{statusMsg.title}</AlertTitle>
                    <AlertDescription>{statusMsg.desc}</AlertDescription>
                </Alert>
            )}

            {/* Search + Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search titles or lecturers..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Filter:</span>
                    {SPECIALIZATIONS.map(spec => (
                        <label key={spec} className="flex items-center gap-1.5 cursor-pointer">
                            <Checkbox
                                checked={filterSpecs.includes(spec)}
                                onCheckedChange={() => toggleSpecFilter(spec)}
                            />
                            <span className="text-xs">{spec}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : filteredTitles.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    {titles.length === 0 ? 'No titles are currently available.' : 'No titles match your search/filter.'}
                </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <SortHeader label="Title" sortKeyName="title" />
                                <SortHeader label="Lecturer" sortKeyName="lecturer" />
                                <TableHead>Specializations</TableHead>
                                <SortHeader label="Available" sortKeyName="quota" />
                                {canBid && <TableHead className="text-right">Action</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTitles.map(title => (
                                <TableRow key={title.id} className="cursor-pointer" onClick={() => window.location.href = `/mahasiswa/titles/${title.id}`}>
                                    <TableCell className="font-medium max-w-[300px]">
                                        <div className="line-clamp-2">{title.title}</div>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">{title.lecturer?.name || '-'}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {(title.specializations || []).map(s => (
                                                <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {title.quota - title.active_groups_count}/{title.quota} group{title.quota > 1 ? 's' : ''}
                                    </TableCell>
                                    {canBid && (
                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                            <Button
                                                size="sm"
                                                onClick={() => handleBid(title.id)}
                                                disabled={biddingId === title.id}
                                            >
                                                {biddingId === title.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                Bid
                                            </Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
