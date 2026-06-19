'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
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
import { Input } from '@/components/ui/input';
import { normalizePeriodList } from '@/lib/normalizers';
import { getApiErrorMessage } from '@/lib/error-utils';

interface Period {
  id: number;
  name: string;
  is_active: boolean;
}

interface Template {
  id: number;
  code: string;
  name: string;
  description: string | null;
  weight: number;
}

interface SelectedComponent {
  id: number;
  template_id: number;
  code: string;
  name: string;
  description: string | null;
  weight: number;
}

const EVALUATION_TYPE_NAMES: Record<string, string> = {
  BIMBINGAN_SEMPRO: 'BIMBINGAN SEMPRO',
  SEMPRO: 'SEMINAR PROPOSAL',
  NILAI_DOSEN: 'NILAI DOSEN',
  MILESTONE: 'MILESTONE',
  EXPO: 'EXPO TA',
  BIMBINGAN_TA: 'BIMBINGAN TA',
  SIDANG_TA: 'SIDANG TA',
};

export default function EditTipePenilaianPage() {
  const router = useRouter();
  const params = useParams();
  const typeId = params.id as string;
  
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [copyFromPeriod, setCopyFromPeriod] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [allTemplates, setAllTemplates] = useState<Template[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<number>>(new Set());

  const fetchPeriods = useCallback(async () => {
    try {
      const res = await api.get('/admin/periods');
      const periodsData = normalizePeriodList(res.data);
      setPeriods(periodsData);
      const active = periodsData.find((p: Period) => p.is_active);
      if (active) setSelectedPeriod(active.id.toString());
    } catch {
      toast.error('Gagal memuat data periode');
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    if (!selectedPeriod || !typeId) return;
    setLoading(true);
    try {
      const res = await api.get(`/admin/periods/${selectedPeriod}/assessment-config`, {
        params: { type: typeId },
      });
      
      const responseData = res.data?.data ?? res.data;
      
      // Set all templates from assessment bank
      setAllTemplates(responseData.all_templates || []);
      
      // Set selected template IDs
      const selectedIds = new Set<number>(
        (responseData.selected_components || []).map((c: SelectedComponent) => c.template_id)
      );
      setSelectedTemplateIds(selectedIds);
    } catch {
      toast.error('Gagal memuat konfigurasi penilaian');
      setAllTemplates([]);
      setSelectedTemplateIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, typeId]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  useEffect(() => {
    if (selectedPeriod) {
      fetchConfig();
    }
  }, [selectedPeriod, fetchConfig]);

  // Get selected components list for left panel
  const selectedComponents = allTemplates.filter(t => selectedTemplateIds.has(t.id));
  const totalWeight = selectedComponents.reduce((sum, c) => sum + Number(c.weight), 0);

  // Filter templates for display
  const filteredTemplates = allTemplates.filter((template) =>
    template.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (template.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalItems = filteredTemplates.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedTemplates = filteredTemplates.slice(startIndex, endIndex);

  const toggleTemplate = (templateId: number) => {
    setSelectedTemplateIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(templateId)) {
        newSet.delete(templateId);
      } else {
        newSet.add(templateId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!selectedPeriod || !typeId) return;
    
    setSaving(true);
    try {
      const templateIds = Array.from(selectedTemplateIds);
      await api.post(`/admin/periods/${selectedPeriod}/assessment-config`, {
        type: typeId,
        template_ids: templateIds,
      });
      toast.success('Konfigurasi berhasil disimpan');
    } catch (error) {
      toast.error(getApiErrorMessage(error) || 'Gagal menyimpan konfigurasi');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyFromPeriod = async () => {
    if (!copyFromPeriod || !selectedPeriod) return;
    
    try {
      await api.post(`/admin/periods/${selectedPeriod}/assessment-config/copy`, {
        source_period_id: copyFromPeriod,
      });
      toast.success('Konfigurasi berhasil disalin');
      fetchConfig();
    } catch (error) {
      toast.error(getApiErrorMessage(error) || 'Gagal menyalin konfigurasi');
    }
  };

  const handleBack = () => {
    router.push('/admin/period-assessment-config');
  };

  const getWeightBadgeStyle = (weight: number) => {
    if (weight >= 40) return 'bg-rose-100 text-rose-700 border-rose-200';
    if (weight >= 25) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-cyan-100 text-cyan-700 border-cyan-200';
  };

  const selectedPeriodName = periods.find(p => p.id.toString() === selectedPeriod)?.name || '';
  const typeName = EVALUATION_TYPE_NAMES[typeId] || typeId;

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-7xl">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-3 max-w-7xl">
      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" onClick={handleBack} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Kembali
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="gap-2 bg-slate-800 hover:bg-slate-900"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Menyimpan...
            </>
          ) : (
            'Simpan'
          )}
        </Button>
      </div>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Edit Tipe Penilaian</h1>
        <p className="text-muted-foreground mt-2">
          Konfigurasikan Tipe penilaian <strong className="text-slate-900">{typeName}</strong> untuk periode <strong className="text-slate-900">{selectedPeriodName}</strong> dengan memilih dari bank komponen penilaian.
        </p>
      </div>

      {/* Main Card - Everything inside */}
      <Card className="border">
        <CardContent className="p-6">
          {/* Salin Penilaian Section */}
          <div className="border rounded-lg p-5 mb-6">
            <h3 className="font-medium text-slate-900 mb-3">Salin Penilaian</h3>
            <Select value={copyFromPeriod} onValueChange={setCopyFromPeriod}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Pilih sumber periode" />
              </SelectTrigger>
              <SelectContent>
                {periods
                  .filter((p) => p.id.toString() !== selectedPeriod)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-2">
              Salin seluruh konfigurasi penilaian dari periode lain.
            </p>
            {copyFromPeriod && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={handleCopyFromPeriod}
              >
                Salin Konfigurasi
              </Button>
            )}
          </div>

          {/* Content Area - Two Columns */}
          <div className="border rounded-lg p-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
              {/* Left Panel */}
              <div className="space-y-5">
                {/* Header Section */}
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Kumpulan Komponen Penilaian</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pilih komponen yang akan digunakan dalam {typeName} untuk periode yang dipilih.
                  </p>
                </div>

                {/* Ringkasan Card */}
                <div className="border rounded-lg p-5">
                  <h3 className="font-semibold text-slate-900 mb-4">Ringkasan</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Komponen</span>
                      <span className="font-medium text-slate-900">{selectedComponents.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Bobot</span>
                      <Badge 
                        className={`${totalWeight === 100 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'} font-medium`}
                        variant="outline"
                      >
                        {totalWeight}%
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Komponen Terpilih Card */}
                <div className="border rounded-lg p-5">
                  <h3 className="font-semibold text-slate-900 mb-3">Komponen terpilih :</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                          <TableHead className="text-xs font-medium text-slate-600">Kode</TableHead>
                          <TableHead className="text-xs font-medium text-slate-600 text-right">Bobot</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedComponents.map((component) => (
                          <TableRow key={component.id} className="hover:bg-slate-50">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Checkbox 
                                  checked={true}
                                  onCheckedChange={() => toggleTemplate(component.id)}
                                />
                                <span className="font-medium text-slate-900">{component.code}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge 
                                variant="outline" 
                                className={getWeightBadgeStyle(component.weight)}
                              >
                                {component.weight}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {selectedComponents.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                              Belum ada komponen yang dipilih
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              {/* Right Panel - Pilih Komponen Card */}
              <div className="border rounded-lg">
                {/* Header with controls */}
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">Pilih Komponen</h3>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          placeholder="Search"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="pl-10 w-[200px] h-9"
                        />
                      </div>
                      <Button variant="outline" size="sm" className="h-9 gap-1.5">
                        <Filter className="h-3.5 w-3.5" />
                        Filter
                      </Button>
                      <Button variant="outline" size="sm" className="h-9 gap-1.5">
                        <ArrowUpDown className="h-3.5 w-3.5" />
                        Sort by
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Components Table */}
                <div className="border-b">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead className="text-xs font-medium text-slate-600">Kode</TableHead>
                        <TableHead className="text-xs font-medium text-slate-600">Deskripsi</TableHead>
                        <TableHead className="text-xs font-medium text-slate-600 text-right w-[80px]">Bobot</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTemplates.map((template) => (
                        <TableRow 
                          key={template.id}
                          className={`${selectedTemplateIds.has(template.id) ? 'bg-slate-50/50' : ''} hover:bg-slate-50 cursor-pointer`}
                          onClick={() => toggleTemplate(template.id)}
                        >
                          <TableCell>
                            <Checkbox 
                              checked={selectedTemplateIds.has(template.id)}
                              onCheckedChange={() => toggleTemplate(template.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">
                            {template.code}
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-slate-600 truncate max-w-[280px]" title={template.description || '-'}>
                              {template.description || '-'}
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge 
                              variant="outline" 
                              className={getWeightBadgeStyle(template.weight)}
                            >
                              {template.weight}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {paginatedTemplates.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Tidak ada komponen yang tersedia
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">Per page</span>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(value) => {
                        setItemsPerPage(parseInt(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-sm text-slate-600">
                    Showing {totalItems > 0 ? startIndex + 1 : 0} to {endIndex} of {totalItems} results
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`h-8 w-8 p-0 ${currentPage === pageNum ? 'bg-slate-800 hover:bg-slate-900' : ''}`}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                    {totalPages > 5 && <span className="px-2 text-slate-400">...</span>}
                    {totalPages > 5 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        className="h-8 w-8 p-0"
                      >
                        {totalPages}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
