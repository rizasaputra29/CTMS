'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, Plus, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { PeriodTable, type Period } from './components/PeriodTable';
import { Loading } from '@/components/ui/loading';
import api from '@/lib/api';
import { toast } from "sonner";

type SortKey = 'name' | 'duration' | 'status';
type SortDir = 'asc' | 'desc';

const PAGE_SIZES = [10, 25, 50];

export default function AdminPeriodsPage() {
    const router = useRouter();
    const [periods, setPeriods] = useState<Period[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Fetch periods
    const fetchPeriods = useCallback(async () => {
        try {
            const response = await api.get('/admin/periods');
            setPeriods(response.data?.data || []);
        } catch (error) {
            console.error('Failed to fetch periods', error);
            toast.error('Gagal memuat data periode');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPeriods();
    }, [fetchPeriods]);

    // Reset page when filters change
    useEffect(() => {
        setPage(1);
    }, [searchQuery, statusFilter, pageSize, sortKey, sortDir]);

    // Filter and sort periods
    const filteredAndSorted = useMemo(() => {
        let result = periods.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all'
                ? true
                : statusFilter === 'active' ? p.is_active : !p.is_active;
            return matchesSearch && matchesStatus;
        });

        result.sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'name') {
                cmp = a.name.localeCompare(b.name);
            } else if (sortKey === 'duration') {
                cmp = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
            } else if (sortKey === 'status') {
                cmp = Number(b.is_active) - Number(a.is_active);
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return result;
    }, [periods, searchQuery, statusFilter, sortKey, sortDir]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginated = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return filteredAndSorted.slice(start, start + pageSize);
    }, [filteredAndSorted, safePage, pageSize]);

    const showingStart = filteredAndSorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const showingEnd = Math.min(safePage * pageSize, filteredAndSorted.length);

    // Handlers
    const handleCreateNew = () => {
        router.push('/admin/periods/new');
    };

    const handleEdit = (period: Period) => {
        router.push(`/admin/periods/${period.id}/edit`);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Apakah Anda yakin ingin menghapus periode ini? Tindakan ini tidak dapat dibatalkan.')) return;
        try {
            await api.delete(`/admin/periods/${id}`);
            toast.success('Periode berhasil dihapus');
            fetchPeriods();
        } catch (error: unknown) {
            console.error('Failed to delete period', error);
            if (api.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Gagal menghapus periode');
            } else {
                toast.error('Gagal menghapus periode');
            }
        }
    };

    const handleToggleActive = async (period: Period) => {
        try {
            await api.put(`/admin/periods/${period.id}`, {
                is_active: !period.is_active,
            });
            toast.success(period.is_active ? 'Periode dinonaktifkan' : 'Periode diaktifkan');
            fetchPeriods();
        } catch (error) {
            console.error('Failed to toggle active', error);
            toast.error('Gagal mengubah status periode');
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

    return (
        <div className="min-h-screen bg-gray-50/50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Periode Capstone & TA</h1>
                        <p className="text-sm text-gray-500 mt-1">Kelola periode akademik, jadwal fase, dan konfigurasi group</p>
                    </div>
                    <Button onClick={handleCreateNew} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Periode Baru
                    </Button>
                </div>

                {/* White Card Container */}
                <div className="bg-white rounded-xl border shadow-sm">
                    {/* Table Header with Controls */}
                    <div className="p-6 border-b">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-semibold text-gray-900">Period Table</h2>
                            </div>
                            
                            <div className="flex flex-1 flex-col sm:flex-row gap-3 sm:justify-end">
                                {/* Search */}
                                <div className="relative w-full sm:w-72">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="Cari periode..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 h-10"
                                    />
                                </div>
                                
                                {/* Filter */}
                                <div className="flex items-center gap-2">
                                    <Filter className="h-4 w-4 text-gray-400" />
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="w-[140px] h-10">
                                            <SelectValue placeholder="Filter status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua Status</SelectItem>
                                            <SelectItem value="active">Aktif</SelectItem>
                                            <SelectItem value="inactive">Nonaktif</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                {/* Sort */}
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleSort('name')}
                                    className="h-10 w-10"
                                >
                                    <ArrowUpDown className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Table Content */}
                    <div className="p-6">
                        {loading ? (
                            <div className="py-16">
                                <Loading variant="section" />
                            </div>
                        ) : filteredAndSorted.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Search className="h-8 w-8 text-gray-400" />
                                </div>
                                <p className="text-gray-500 font-medium">Tidak ada periode ditemukan</p>
                                <p className="text-sm text-gray-400 mt-1">
                                    Coba ubah filter atau buat periode baru
                                </p>
                            </div>
                        ) : (
                            <>
                                <PeriodTable
                                    periods={paginated}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    onToggleActive={handleToggleActive}
                                />

                                {/* Pagination */}
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t">
                                    <div className="flex items-center gap-4">
                                        <p className="text-sm text-gray-600">
                                            Showing {showingStart} to {showingEnd} of {filteredAndSorted.length} results
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-500">Per page:</span>
                                            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                                                <SelectTrigger className="h-8 w-[70px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PAGE_SIZES.map(s => (
                                                        <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={safePage === 1}
                                        >
                                            Previous
                                        </Button>
                                        
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                const pageNum = i + 1;
                                                return (
                                                    <Button
                                                        key={pageNum}
                                                        variant={safePage === pageNum ? 'default' : 'outline'}
                                                        size="icon"
                                                        onClick={() => setPage(pageNum)}
                                                        className="h-8 w-8"
                                                    >
                                                        {pageNum}
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                        
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            disabled={safePage === totalPages}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
