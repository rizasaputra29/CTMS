'use client';

import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Loader2, Check, X, Search, ArrowUpDown } from 'lucide-react';
import { toast } from "sonner";

interface Group {
    id: number;
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

type SortKey = 'title' | 'members' | 'status' | 'date';
type SortDir = 'asc' | 'desc';

export default function DosenRequestsPage() {
    const [requests, setRequests] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const fetchRequests = async () => {
        try {
            const response = await api.get('/dosen/groups/pending');
            setRequests(response.data.data);
        } catch (error) {
            console.error('Failed to fetch requests', error);
            toast.error('Failed to load guidance requests');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleAction = async (groupId: number, action: 'approve' | 'reject') => {
        try {
            await api.put(`/dosen/groups/${groupId}/${action}`);
            toast.success(`Group ${action}d successfully`);
            fetchRequests();
        } catch (error) {
            console.error(`Failed to ${action} group`, error);
            toast.error(`Failed to ${action} group`);
        }
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const filteredRequests = useMemo(() => {
        let result = requests;
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(g =>
                g.title?.title?.toLowerCase().includes(q) ||
                g.members.some(m => m.student.name.toLowerCase().includes(q) || m.student.email.toLowerCase().includes(q))
            );
        }
        result = [...result].sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'title') cmp = (a.title?.title || '').localeCompare(b.title?.title || '');
            else if (sortKey === 'members') cmp = a.members.length - b.members.length;
            else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
            else if (sortKey === 'date') cmp = (a.created_at || '').localeCompare(b.created_at || '');
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return result;
    }, [requests, search, sortKey, sortDir]);

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
                <h1 className="text-3xl font-bold tracking-tight">Guidance Requests</h1>
                <p className="text-muted-foreground">Review and approve student groups bidding for your titles.</p>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by title or student..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : filteredRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                    {requests.length === 0 ? 'No pending requests.' : 'No requests match your search.'}
                </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60px]">Group</TableHead>
                                <SortHeader label="Title" sortKeyName="title" />
                                <SortHeader label="Members" sortKeyName="members" />
                                <SortHeader label="Status" sortKeyName="status" />
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRequests.map(group => (
                                <TableRow key={group.id}>
                                    <TableCell className="font-medium">#{group.id}</TableCell>
                                    <TableCell className="max-w-[250px]">
                                        <div className="line-clamp-2 font-medium">{group.title?.title || 'No title'}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {group.members.map(m => (
                                                <Badge key={m.id} variant="outline" className="text-xs">
                                                    {m.student.name}{m.is_leader ? ' ★' : ''}
                                                </Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={
                                            group.status === 'APPROVED' ? 'default' :
                                            group.status === 'REJECTED' ? 'destructive' : 'secondary'
                                        }>
                                            {group.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                                        <X className="mr-1 h-4 w-4" /> Reject
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Reject Group?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will reject the group&apos;s bid. They will need to bid again.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleAction(group.id, 'reject')}>
                                                            Confirm Reject
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="default" size="sm">
                                                        <Check className="mr-1 h-4 w-4" /> Approve
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Approve Group?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will accept the group for guidance under this title.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleAction(group.id, 'approve')}>
                                                            Confirm Approve
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
