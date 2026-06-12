"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Trash2,
  Edit,
  Search,
  Filter,
  ArrowUpDown,
  MapPin,
  Check,
  Ellipsis,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PaginationCustom } from "@/components/common/PaginationCustom";
import { toast } from "sonner";
import {
  locationSchema,
  type LocationFormData,
} from "@/lib/validations/location";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { toScheduleMode } from "@/types";
import { Loading } from "@/components/ui/loading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Location {
  id: number;
  name: string;
  capacity: number | null;
  type: "offline" | "online";
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type SortKey = "name" | "type" | "capacity" | "status";
type SortDir = "asc" | "desc";

export default function AdminLocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const form = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      type: "offline",
      capacity: "",
      description: "",
      is_active: true,
    },
  });

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/locations/all");
      setLocations(res.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch locations", err);
      toast.error("Failed to load locations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, typeFilter, statusFilter, pageSize, sortKey, sortDir]);

  const filteredAndSorted = useMemo(() => {
    let result = [...locations];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.description?.toLowerCase() || "").includes(q)
      );
    }

    if (typeFilter !== "all") {
      result = result.filter((l) => l.type === typeFilter);
    }

    if (statusFilter === "active") {
      result = result.filter((l) => l.is_active);
    } else if (statusFilter === "inactive") {
      result = result.filter((l) => !l.is_active);
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortKey === "type") {
        cmp = a.type.localeCompare(b.type);
      } else if (sortKey === "capacity") {
        cmp = (a.capacity || 0) - (b.capacity || 0);
      } else if (sortKey === "status") {
        cmp = Number(b.is_active) - Number(a.is_active);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [locations, searchQuery, typeFilter, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSorted.length / pageSize)
  );
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, safePage, pageSize]);

  const resetForm = () => {
    setEditing(null);
    form.reset({
      name: "",
      type: "offline",
      capacity: "",
      description: "",
      is_active: true,
    });
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (location: Location) => {
    setEditing(location);
    form.reset({
      name: location.name,
      type: location.type,
      capacity: location.capacity?.toString() || "",
      description: location.description || "",
      is_active: location.is_active,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: LocationFormData) => {
    try {
      const payload = {
        name: data.name,
        type: data.type,
        capacity: data.capacity ? parseInt(data.capacity) : null,
        description: data.description || null,
        is_active: data.is_active,
      };

      if (editing) {
        await api.put(`/locations/${editing.id}`, payload);
        toast.success("Location updated successfully");
      } else {
        await api.post("/locations", payload);
        toast.success("Location created successfully");
      }

      setDialogOpen(false);
      resetForm();
      fetchLocations();
    } catch (error) {
      console.error("Failed to save location", error);
      const message = api.getApiErrorMessage(error, "Failed to save location");
      toast.error(message);
    }
  };

  const handleDelete = async (location: Location) => {
    if (
      !confirm(
        `Are you sure you want to delete "${location.name}"?\n\nNote: Location must be inactive before deletion.`
      )
    ) {
      return;
    }

    setDeleting(location.id);
    try {
      await api.delete(`/locations/${location.id}`);
      toast.success("Location deleted successfully");
      fetchLocations();
    } catch (error) {
      console.error("Failed to delete location", error);
      const message = api.getApiErrorMessage(
        error,
        "Failed to delete location"
      );
      toast.error(message);
    } finally {
      setDeleting(null);
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
            <h1 className="text-xl font-bold text-gray-900">Locations</h1>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Tambah Lokasi
          </Button>
        </div>

        {/* White Card Container */}
        <div className="rounded-xl border">
          {/* Table Header with Controls */}
          <div className="border-b px-6 py-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">
                  Location Table
                </h2>
              </div>

              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:justify-end">
                {/* Search */}
                <div className="relative w-full sm:w-72">
                  <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Cari lokasi..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 pl-9"
                  />
                </div>

                {/* Type Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-10 cursor-pointer gap-2 bg-white"
                    >
                      <Filter className="h-4 w-4" />
                      Tipe
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-44 p-1">
                    {[
                      { value: "all", label: "Semua Tipe" },
                      { value: "offline", label: "Offline" },
                      { value: "online", label: "Online" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setTypeFilter(option.value)}
                        className="hover:bg-accent hover:text-accent-foreground flex w-full cursor-pointer items-center rounded-sm px-3 py-2 text-sm"
                      >
                        <span className="mr-2 w-4">
                          {typeFilter === option.value && (
                            <Check className="h-4 w-4" />
                          )}
                        </span>
                        {option.label}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>

                {/* Status Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-10 cursor-pointer gap-2 bg-white"
                    >
                      <Filter className="h-4 w-4" />
                      Status
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
                      { value: "type" as SortKey, label: "Tipe" },
                      { value: "capacity" as SortKey, label: "Kapasitas" },
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
                  <MapPin className="h-8 w-8 text-gray-400" />
                </div>
                <p className="font-medium text-gray-500">
                  Tidak ada lokasi ditemukan
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  Coba ubah filter atau buat lokasi baru
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                      <TableHead
                        className="cursor-pointer pl-4 font-semibold text-gray-700"
                        onClick={() => handleSort("name")}
                      >
                        Nama
                      </TableHead>
                      <TableHead
                        className="cursor-pointer font-semibold text-gray-700"
                        onClick={() => handleSort("type")}
                      >
                        Tipe
                      </TableHead>
                      <TableHead
                        className="cursor-pointer font-semibold text-gray-700"
                        onClick={() => handleSort("capacity")}
                      >
                        Kapasitas
                      </TableHead>
                      <TableHead
                        className="cursor-pointer text-center font-semibold text-gray-700"
                        onClick={() => handleSort("status")}
                      >
                        Status
                      </TableHead>
                      <TableHead className="w-16 pr-4 text-center">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((location) => (
                      <TableRow
                        key={location.id}
                        className={!location.is_active ? "bg-gray-50/50" : ""}
                      >
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-2">
                            <MapPin
                              className={`h-4 w-4 ${location.is_active ? "text-blue-600" : "text-gray-400"}`}
                            />
                            <span
                              className={`font-medium ${!location.is_active ? "text-gray-500" : ""}`}
                            >
                              {location.name}
                            </span>
                          </div>
                          {location.description && (
                            <p className="mt-0.5 ml-6 text-xs text-gray-500">
                              {location.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              location.type === "offline"
                                ? "default"
                                : "secondary"
                            }
                            className="text-[11px]"
                          >
                            {location.type === "offline" ? "Offline" : "Online"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {location.capacity ? location.capacity : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {location.is_active ? (
                            <Badge
                              variant="outline"
                              className="border-green-600 text-green-800 hover:bg-green-100"
                            >
                              <span className="mr-0.5 h-1.5 w-1.5 rounded-full bg-green-600"></span>
                              Aktif
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-gray-600 text-gray-600 hover:bg-gray-200"
                            >
                              <span className="mr-0.5 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
                              Nonaktif
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="pr-4 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <Ellipsis className="h-4 w-4 text-gray-500" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openEdit(location)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(location)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Hapus
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Location" : "Add Location"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the location details below."
                : "Create a new location for scheduling events and sessions."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-4 py-4">
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Name<span className="text-red-500 mb-1 ml-0.5">*</span></FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      placeholder="e.g., Lab IF-101, Zoom Meeting Room"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError>{fieldState.error?.message}</FieldError>
                    )}
                  </Field>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <Controller
                  name="type"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>Type<span className="text-red-500 mb-1 ml-0.5">*</span></FieldLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) => field.onChange(toScheduleMode(v))}
                      >
                        <SelectTrigger
                          id={field.name}
                          aria-invalid={fieldState.invalid}
                          className="w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="offline">Offline</SelectItem>
                          <SelectItem value="online">Online</SelectItem>
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && (
                        <FieldError>{fieldState.error?.message}</FieldError>
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="capacity"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>
                        Capacity (optional)
                      </FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        type="number"
                        min="1"
                        placeholder="e.g., 30"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError>{fieldState.error?.message}</FieldError>
                      )}
                    </Field>
                  )}
                />
              </div>
              <Controller
                name="description"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>
                      Description (optional)
                    </FieldLabel>
                    <Textarea
                      {...field}
                      id={field.name}
                      placeholder="Additional details about this location..."
                      rows={3}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError>{fieldState.error?.message}</FieldError>
                    )}
                  </Field>
                )}
              />
              <Controller
                name="is_active"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    orientation="horizontal"
                    data-invalid={fieldState.invalid}
                  >
                    <FieldLabel htmlFor={field.name}>Active</FieldLabel>
                    <Switch
                      id={field.name}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError>{fieldState.error?.message}</FieldError>
                    )}
                  </Field>
                )}
              />
              {editing && (
                <p className="text-xs text-gray-500">
                  Tip: Set to inactive to prevent this location from appearing
                  in schedule dropdowns.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <span className="mr-2 animate-spin">⟳</span>
                    Saving...
                  </>
                ) : editing ? (
                  "Save Changes"
                ) : (
                  "Create Location"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
