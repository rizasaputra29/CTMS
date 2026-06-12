"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, Plus, ArrowUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PeriodTable, type Period } from "./components/PeriodTable";
import { Loading } from "@/components/ui/loading";
import { PaginationCustom } from "@/components/common/PaginationCustom";
import api from "@/lib/api";
import { toast } from "sonner";

type SortKey = "name" | "duration" | "status";
type SortDir = "asc" | "desc";

export default function AdminPeriodsPage() {
  const router = useRouter();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch periods
  const fetchPeriods = useCallback(async () => {
    try {
      const response = await api.get("/admin/periods");
      setPeriods(response.data?.data || []);
    } catch (error) {
      console.error("Failed to fetch periods", error);
      toast.error("Gagal memuat data periode");
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
    let result = periods.filter((p) => {
      const matchesSearch = p.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
            ? p.is_active
            : !p.is_active;
      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortKey === "duration") {
        cmp =
          new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      } else if (sortKey === "status") {
        cmp = Number(b.is_active) - Number(a.is_active);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [periods, searchQuery, statusFilter, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSorted.length / pageSize)
  );
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, safePage, pageSize]);

  const showingStart =
    filteredAndSorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingEnd = Math.min(safePage * pageSize, filteredAndSorted.length);

  // Handlers
  const handleCreateNew = () => {
    router.push("/admin/periods/new");
  };

  const handleEdit = (period: Period) => {
    router.push(`/admin/periods/${period.id}/edit`);
  };

  const handleDelete = async (id: number) => {
    if (
      !confirm(
        "Apakah Anda yakin ingin menghapus periode ini? Tindakan ini tidak dapat dibatalkan."
      )
    )
      return;
    try {
      await api.delete(`/admin/periods/${id}`);
      toast.success("Periode berhasil dihapus");
      fetchPeriods();
    } catch (error: unknown) {
      console.error("Failed to delete period", error);
      if (api.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Gagal menghapus periode");
      } else {
        toast.error("Gagal menghapus periode");
      }
    }
  };

  const handleToggleActive = async (period: Period) => {
    try {
      await api.put(`/admin/periods/${period.id}`, {
        is_active: !period.is_active,
      });
      toast.success(
        period.is_active ? "Periode dinonaktifkan" : "Periode diaktifkan"
      );
      fetchPeriods();
    } catch (error) {
      console.error("Failed to toggle active", error);
      toast.error("Gagal mengubah status periode");
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Periode Capstone & TA
            </h1>
          </div>
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Periode Baru
          </Button>
        </div>

        {/* White Card Container */}
        <div className="rounded-xl border">
          {/* Table Header with Controls */}
          <div className="border-b px-6 py-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">
                  Period Table
                </h2>
              </div>

              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:justify-end">
                {/* Search */}
                <div className="relative w-full sm:w-72">
                  <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Cari periode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 pl-9"
                  />
                </div>

                {/* Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-10 cursor-pointer gap-2 bg-white"
                    >
                      <Filter className="h-4 w-4" />
                      Filter
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-44 p-1">
                    {[
                      { value: "all", label: "Semua Status" },
                      { value: "active", label: "Aktif" },
                      { value: "inactive", label: "Nonaktif" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setStatusFilter(option.value)}
                        className="hover:bg-accent hover:text-accent-foreground flex w-full cursor-pointer items-center rounded-sm px-3 py-2 text-sm"
                      >
                        <span className="mr-2 w-4">
                          {statusFilter === option.value && (
                            <Check className="h-4 w-4" />
                          )}
                        </span>
                        {option.label}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>

                {/* Sort */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-10 cursor-pointer gap-2 bg-white"
                    >
                      <ArrowUpDown className="h-4 w-4" />
                      Sort by
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-44 p-1">
                    {[
                      { value: "name" as SortKey, label: "Nama" },
                      { value: "duration" as SortKey, label: "Durasi" },
                      { value: "status" as SortKey, label: "Status" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleSort(option.value)}
                        className="hover:bg-accent hover:text-accent-foreground flex w-full cursor-pointer items-center rounded-sm px-3 py-2 text-sm"
                      >
                        <span className="mr-2 w-4">
                          {sortKey === option.value && (
                            <Check className="h-4 w-4" />
                          )}
                        </span>
                        {option.label}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Table Content */}
          <div>
            {loading ? (
              <div className="py-16">
                <Loading variant="section" />
              </div>
            ) : filteredAndSorted.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <Search className="h-8 w-8 text-gray-400" />
                </div>
                <p className="font-medium text-gray-500">
                  Tidak ada periode ditemukan
                </p>
                <p className="mt-1 text-sm text-gray-400">
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
                <PaginationCustom
                  page={safePage}
                  pageSize={pageSize}
                  totalItems={filteredAndSorted.length}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
