'use client';

import { Check, X, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PageHeader } from '@/components/common/PageHeader';
import { SortableTableHeader } from '@/components/common/SortableTableHeader';
import { useRequests } from '../hooks/use-requests';

export function RequestsFeature() {
    const {
        loading,
        search,
        sortKey,
        filteredRequests,
        setSearch,
        handleSort,
        handleAction,
    } = useRequests();

    return (
        <div className="space-y-6">
            <PageHeader
                title="Guidance Requests"
                description="Review and approve student groups bidding for your titles."
            />

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
                <EmptyState
                    icon={Search}
                    title={search ? 'No requests match your search' : 'No pending requests'}
                />
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60px]">Group</TableHead>
                                <SortableTableHeader label="Title" sortKey="title" currentSortKey={sortKey} onSort={handleSort} />
                                <SortableTableHeader label="Members" sortKey="members" currentSortKey={sortKey} onSort={handleSort} />
                                <SortableTableHeader label="Status" sortKey="status" currentSortKey={sortKey} onSort={handleSort} />
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
                                                <span key={m.id} className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium">
                                                    {m.student.name}{m.is_leader ? ' ★' : ''}
                                                </span>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={group.status} category="group" />
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
                                                        <AlertDialogAction onClick={() => handleAction({ groupId: group.id, action: 'reject' })}>
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
                                                        <AlertDialogAction onClick={() => handleAction({ groupId: group.id, action: 'approve' })}>
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
