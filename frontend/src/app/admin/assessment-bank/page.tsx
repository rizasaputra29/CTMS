'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, Filter, ArrowUpDown, MoreHorizontal, Trash2, Archive, ArchiveRestore, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { Loading } from '@/components/ui/loading';
import { getApiErrorMessage } from '@/lib/error-utils';

interface Template {
  id: number;
  code: string;
  name: string;
  description: string | null;
  weight: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type SortKey = 'code' | 'description' | 'status' | 'weight';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'inactive';

const PAGE_SIZES = [10, 25, 50];

export default function AssessmentBankPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('code');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const router = useRouter();

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/assessment-templates');
      setTemplates(res.data?.data || []);
    } catch (error) {
      toast.error('Gagal memuat data komponen penilaian');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [searchQuery, statusFilter, pageSize, sortKey, sortDir]);

  const filteredAndSorted = useMemo(() => {
    let result = [...templates];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.code.toLowerCase().includes(q) ||
        (t.description?.toLowerCase() || '').includes(q)
      );
    }

    // Status filter
    if (statusFilter === 'active') {
      result = result.filter(t => t.is_active);
    } else if (statusFilter === 'inactive') {
      result = result.filter(t => !t.is_active);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'code') {
        cmp = a.code.localeCompare(b.code);
      } else if (sortKey === 'description') {
        cmp = (a.description || '').localeCompare(b.description || '');
      } else if (sortKey === 'status') {
        cmp = Number(a.is_active) - Number(b.is_active);
      } else if (sortKey === 'weight') {
        cmp = a.weight - b.weight;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [templates, searchQuery, statusFilter, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, safePage, pageSize]);

  const showingStart = filteredAndSorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingEnd = Math.min(safePage * pageSize, filteredAndSorted.length);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map(t => t.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkActivate = async () => {
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map(id => 
        api.put(`/admin/assessment-templates/${id}`, { is_active: true })
      ));
      toast.success(`${ids.length} komponen diaktifkan`);
      setSelectedIds(new Set());
      fetchTemplates();
    } catch (error) {
      toast.error('Gagal mengaktifkan komponen');
    }
  };

  const handleBulkDeactivate = async () => {
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map(id => 
        api.put(`/admin/assessment-templates/${id}`, { is_active: false })
      ));
      toast.success(`${ids.length} komponen dinonaktifkan`);
      setSelectedIds(new Set());
      fetchTemplates();
    } catch (error) {
      toast.error('Gagal menonaktifkan komponen');
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.size} komponen?`)) {
      return;
    }
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map(id => api.delete(`/admin/assessment-templates/${id}`)));
      toast.success(`${ids.length} komponen dihapus`);
      setSelectedIds(new Set());
      fetchTemplates();
    } catch (error) {
      toast.error('Gagal menghapus komponen');
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

  const handleCreate = () => {
    router.push('/admin/assessment-bank/new');
  };

  const handleEdit = (template: Template) => {
    router.push(`/admin/assessment-bank/${template.id}/edit`);
  };

  const handleDelete = async (template: Template) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus "${template.code}"?`)) {
      return;
    }
    try {
      await api.delete(`/admin/assessment-templates/${template.id}`);
      toast.success('Komponen berhasil dihapus');
      fetchTemplates();
    } catch (error) {
      toast.error(getApiErrorMessage(error) || 'Gagal menghapus komponen');
    }
  };

  const handleToggleActive = async (template: Template) => {
    try {
      await api.put(`/admin/assessment-templates/${template.id}`, {
        is_active: !template.is_active,
      });
      toast.success(template.is_active ? 'Komponen dinonaktifkan' : 'Komponen diaktifkan');
      fetchTemplates();
    } catch (error) {
      toast.error(getApiErrorMessage(error) || 'Gagal mengubah status komponen');
    }
  };

  const getWeightBadgeColor = (weight: number) => {
    if (weight > 50) return 'bg-red-50 text-red-700 border-red-200';
    if (weight >= 25) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-green-50 text-green-700 border-green-200';
  };

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <TableHead 
      className="cursor-pointer select-none hover:bg-gray-50 whitespace-nowrap" 
      onClick={() => handleSort(sortKeyName)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortKey === sortKeyName ? 'opacity-100 text-gray-900' : 'opacity-40'}`} />
      </div>
    </TableHead>
  );

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bank Asesmen</h1>
            <p className="text-sm text-gray-500 mt-1">
              Kelola template master komponen penilaian (CPMK/CPL) yang dapat digunakan di berbagai periode.
            </p>
          </div>
          <Button onClick={handleCreate} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <Plus className="h-4 w-4" />
            Tambah Penilaian
          </Button>
        </div>

        {/* White Card Container */}
        <div className="bg-white rounded-xl border shadow-sm">
          {/* Table Header with Controls */}
          <div className="p-6 border-b">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">Tabel Komponen</h2>
              </div>
              
              <div className="flex flex-1 flex-col sm:flex-row gap-3 sm:justify-end">
                {/* Search */}
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10"
                  />
                </div>
                
                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
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
                  onClick={() => handleSort('code')}
                  className="h-10 w-10"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Bulk Actions Toolbar */}
          {selectedIds.size > 0 && (
            <div className="px-6 py-3 bg-indigo-50 border-b flex items-center justify-between">
              <span className="text-sm font-medium text-indigo-900">
                {selectedIds.size} terpilih
              </span>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleBulkActivate}
                  className="h-8"
                >
                  <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" />
                  Aktifkan
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleBulkDeactivate}
                  className="h-8"
                >
                  <Archive className="h-3.5 w-3.5 mr-1.5" />
                  Nonaktifkan
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleBulkDelete}
                  className="h-8"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Hapus
                </Button>
              </div>
            </div>
          )}

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
                <p className="text-gray-500 font-medium">Tidak ada komponen ditemukan</p>
                <p className="text-sm text-gray-400 mt-1">
                  {searchQuery || statusFilter !== 'all'
                    ? 'Coba ubah filter pencarian'
                    : 'Buat komponen pertama untuk memulai'}
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 hover:bg-gray-50">
                        <TableHead className="w-[40px]">
                          <Checkbox 
                            checked={paginated.length > 0 && selectedIds.size === paginated.length}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <SortHeader label="Kode" sortKeyName="code" />
                        <SortHeader label="Deskripsi" sortKeyName="description" />
                        <SortHeader label="Status" sortKeyName="status" />
                        <SortHeader label="Bobot" sortKeyName="weight" />
                        <TableHead className="w-[60px] text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((template) => (
                        <TableRow 
                          key={template.id} 
                          className={!template.is_active ? 'bg-gray-50/50' : ''}
                        >
                          <TableCell>
                            <Checkbox 
                              checked={selectedIds.has(template.id)}
                              onCheckedChange={() => toggleSelect(template.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <span className={`font-medium ${!template.is_active ? 'text-gray-500' : 'text-gray-900'}`}>
                              {template.code}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`text-sm ${!template.is_active ? 'text-gray-400' : 'text-gray-700'}`}>
                              {template.description || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {template.is_active ? (
                              <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50 text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                                Aktif
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-600 border-gray-300 hover:bg-gray-50 text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-1.5"></span>
                                Nonaktif
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getWeightBadgeColor(template.weight)}`}
                            >
                              {template.weight}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(template)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleActive(template)}>
                                  {template.is_active ? (
                                    <>
                                      <Archive className="h-4 w-4 mr-2" />
                                      Nonaktifkan
                                    </>
                                  ) : (
                                    <>
                                      <ArchiveRestore className="h-4 w-4 mr-2" />
                                      Aktifkan
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(template)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Hapus
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

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
                      {totalPages > 5 && (
                        <>
                          <span className="px-2 text-gray-400">...</span>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setPage(totalPages)}
                            className="h-8 w-8"
                          >
                            {totalPages}
                          </Button>
                        </>
                      )}
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
