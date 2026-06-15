import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { Group, SortKey, SortDir } from '../types';

export function useRequests() {
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

    return {
        requests,
        loading,
        search,
        sortKey,
        sortDir,
        filteredRequests,
        setSearch,
        handleSort,
        handleAction,
    };
}
