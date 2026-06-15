'use client';

import { Check, X, Search, ArrowUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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
} from '@/components/ui/alert-dialog';
import { useRequests } from '../hooks/use-requests';
import type { SortKey } from '../types';

export function RequestsFeature() {
    const {
        loading,
        search,
        sortKey,
        sortDir,
        filteredRequests,
        setSearch,
        handleSort,
        handleAction,
    } = useRequests();

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

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by title or student..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                />
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : filteredRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                    {search ? 'No requests match your search.' : 'No pending requests.'}
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
                                    <TableCell className="font-medium">{group.code || `#${group.id}`}</TableCell>
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
