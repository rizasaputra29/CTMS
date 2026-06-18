"use client";

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { Group, SortKey, SortDir } from '../types';

const QUERY_KEY = ['dosen', 'requests'] as const;

export function useRequests() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const { data: requests = [], isLoading: loading } = useQuery({
        queryKey: QUERY_KEY,
        queryFn: async () => {
            const response = await api.get('/dosen/groups/pending');
            return (response.data?.data || []) as Group[];
        },
    });

    const actionMutation = useMutation({
        mutationFn: async ({ groupId, action }: { groupId: number; action: 'approve' | 'reject' }) => {
            await api.put(`/dosen/groups/${groupId}/${action}`);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            toast.success(`Group ${variables.action}d successfully`);
        },
        onError: (error, variables) => {
            toast.error(api.getApiErrorMessage(error, `Failed to ${variables.action} group`));
        },
    });

    const handleSort = useCallback((key: SortKey) => {
        setSortDir(prevDir => (sortKey === key ? (prevDir === 'asc' ? 'desc' : 'asc') : 'asc'));
        setSortKey(key);
    }, [sortKey]);

    const filteredRequests = useMemo(() => {
        let result = [...requests];
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(g =>
                g.title?.title?.toLowerCase().includes(q) ||
                g.members.some(m => m.student.name.toLowerCase().includes(q) || m.student.email.toLowerCase().includes(q))
            );
        }
        result.sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'title') cmp = (a.title?.title || '').localeCompare(b.title?.title || '');
            else if (sortKey === 'members') cmp = a.members.length - b.members.length;
            else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
            else if (sortKey === 'date') cmp = (a.created_at || '').localeCompare(b.created_at || '');
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return result;
    }, [requests, search, sortKey, sortDir]);

    return {
        requests,
        loading,
        search,
        sortKey,
        sortDir,
        filteredRequests,
        setSearch,
        handleSort,
        handleAction: actionMutation.mutate,
        isActionPending: actionMutation.isPending,
    };
}
