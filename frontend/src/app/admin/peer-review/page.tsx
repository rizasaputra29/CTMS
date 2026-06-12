'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Filter, ArrowUpDown, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { normalizePeriodList } from '@/lib/normalizers';

interface Period {
  id: number;
  name: string;
  is_active: boolean;
}

interface PeerReviewConfig {
  id: string;
  name: string;
  total_components: number;
  components: string[];
}

const PEER_REVIEW_CONFIG: PeerReviewConfig = {
  id: 'PEER_REVIEW',
  name: 'PEER REVIEW',
  total_components: 0,
  components: [],
};

export default function PeerReviewPage() {
  const router = useRouter();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [configData, setConfigData] = useState<PeerReviewConfig>(PEER_REVIEW_CONFIG);

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
    if (!selectedPeriod) return;
    setLoading(true);
    try {
      const res = await api.get(`/admin/periods/${selectedPeriod}/peer-review-config`);
      const selectedIndicators = res.data.selected_indicators || [];
      setConfigData({
        ...PEER_REVIEW_CONFIG,
        total_components: selectedIndicators.length,
        components: selectedIndicators.map((i: { code: string }) => i.code),
      });
    } catch {
      setConfigData(PEER_REVIEW_CONFIG);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  useEffect(() => {
    if (selectedPeriod) {
      fetchConfig();
    }
  }, [selectedPeriod, fetchConfig]);

  const filteredConfig = configData.name.toLowerCase().includes(searchQuery.toLowerCase())
    ? configData
    : null;

  const displayData = filteredConfig ? [filteredConfig] : [];
  const totalItems = displayData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedData = displayData.slice(startIndex, endIndex);

  const handleEdit = () => {
    router.push('/admin/peer-review/PEER_REVIEW/edit');
  };

  const selectedPeriodName = periods.find(p => p.id.toString() === selectedPeriod)?.name || 'Pilih Periode';

  if (loading && periods.length === 0) {
    return (
      <div className="container mx-auto py-6 max-w-7xl">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      {/* Title Section with Period Selector */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Peer Review</h1>
          <p className="text-muted-foreground mt-1">
            Konfigurasikan indikator Peer Review untuk setiap periode.
          </p>
        </div>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Pilih Periode" />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.id} value={p.id.toString()}>
                {p.name} {p.is_active && '(Aktif)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table Card */}
      <Card>
        <CardContent className="p-6">
          {/* Table Header with controls */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Tabel Peer Review</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-[280px]"
                />
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowUpDown className="h-4 w-4" />
                Sort by
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[60px]">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="rounded border-gray-300" />
                      No
                    </div>
                  </TableHead>
                  <TableHead>Tipe Penilaian</TableHead>
                  <TableHead>Total Komponen</TableHead>
                  <TableHead>Komponen Penilaian</TableHead>
                  <TableHead className="w-[100px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Tidak ada data yang tersedia
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((type, index) => (
                    <TableRow key={type.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" className="rounded border-gray-300" />
                          {startIndex + index + 1}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell>{type.total_components} Komponen</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {type.components.length > 0 ? (
                            type.components.map((comp, idx) => (
                              <Badge key={idx} variant="secondary" className="font-normal">
                                {comp}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">Belum dikonfigurasi</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={handleEdit}>
                              Edit
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Per page</span>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(parseInt(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span className="text-sm text-muted-foreground">
                Showing {totalItems > 0 ? startIndex + 1 : 0} to {endIndex} of {totalItems} results
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
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
                    className="min-w-[32px]"
                  >
                    {pageNum}
                  </Button>
                );
              })}
              {totalPages > 5 && <span className="px-2">...</span>}
              {totalPages > 5 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  className="min-w-[32px]"
                >
                  {totalPages}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
