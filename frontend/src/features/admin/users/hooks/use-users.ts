"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";
import type { RoleTab } from "@/types/guards";
import type { User, PaginationData, SortKey, SortDir, StatusFilter } from "../types";

const QUERY_KEY = ["admin", "users"] as const;

interface UsersFilters {
  search: string;
  role: RoleTab;
  status: StatusFilter;
  sortKey: SortKey;
  sortDir: SortDir;
}

interface UserPayload {
  name: string;
  email: string;
  roles: ("admin" | "dosen" | "mahasiswa")[];
  password?: string;
  nim?: string;
}

interface UseUsersReturn {
  users: User[];
  loading: boolean;
  pagination: PaginationData;
  filters: UsersFilters;
  setSearch: (search: string) => void;
  setRole: (role: RoleTab) => void;
  setStatus: (status: StatusFilter) => void;
  setSort: (key: SortKey) => void;
  setPage: (page: number) => void;
  setPerPage: (perPage: number) => void;
  createUser: (data: UserPayload) => Promise<void>;
  updateUser: (id: number, data: UserPayload) => Promise<void>;
  deleteUser: (id: number) => Promise<void>;
  bulkDeleteUsers: (ids: number[]) => Promise<void>;
  kickFromPeriod: (user: User) => Promise<void>;
  kickingUserId: number | null;
}

export function useUsers(): UseUsersReturn {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<UsersFilters>({
    search: "",
    role: "all",
    status: "all",
    sortKey: "name",
    sortDir: "asc",
  });
  const [pagination, setPagination] = useState<PaginationData>({
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 0,
  });
  const [kickingUserId, setKickingUserId] = useState<number | null>(null);

  const queryKey = [
    ...QUERY_KEY,
    filters.search,
    filters.role,
    filters.status,
    filters.sortKey,
    filters.sortDir,
    pagination.current_page,
    pagination.per_page,
  ];

  const { data: usersResponse, isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params: Record<string, string> = {
        page: pagination.current_page.toString(),
        per_page: pagination.per_page.toString(),
        sort_by: filters.sortKey,
        sort_order: filters.sortDir,
      };

      if (filters.role !== "all") {
        params.role = filters.role;
      }
      if (filters.status !== "all") {
        params.status = filters.status;
      }
      if (filters.search) {
        params.search = filters.search;
      }

      const response = await api.get("/admin/users", { params });
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: UserPayload) => {
      await api.post("/admin/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UserPayload }) => {
      await api.put(`/admin/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map((id) => api.delete(`/admin/users/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const kickMutation = useMutation({
    mutationFn: async ({
      periodId,
      userId,
    }: {
      periodId: number;
      userId: number;
    }) => {
      const response = await api.delete(
        `/admin/periods/${periodId}/students/${userId}/registration`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onSettled: () => {
      setKickingUserId(null);
    },
  });

  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }));
    setPagination((prev) => ({ ...prev, current_page: 1 }));
  }, []);

  const setRole = useCallback((role: RoleTab) => {
    setFilters((prev) => ({ ...prev, role }));
    setPagination((prev) => ({ ...prev, current_page: 1 }));
  }, []);

  const setStatus = useCallback((status: StatusFilter) => {
    setFilters((prev) => ({ ...prev, status }));
    setPagination((prev) => ({ ...prev, current_page: 1 }));
  }, []);

  const setSort = useCallback((key: SortKey) => {
    setFilters((prev) => {
      if (prev.sortKey === key) {
        return { ...prev, sortDir: prev.sortDir === "asc" ? "desc" : "asc" };
      }
      return { ...prev, sortKey: key, sortDir: "asc" };
    });
    setPagination((prev) => ({ ...prev, current_page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, current_page: page }));
  }, []);

  const setPerPage = useCallback((perPage: number) => {
    setPagination((prev) => ({ ...prev, per_page: perPage, current_page: 1 }));
  }, []);

  const createUser = useCallback(
    async (data: UserPayload) => {
      await toast.promise(createMutation.mutateAsync(data), {
        loading: "Creating user...",
        success: "User created successfully",
        error: (error) => api.getApiErrorMessage(error, "Failed to create user"),
      });
    },
    [createMutation]
  );

  const updateUser = useCallback(
    async (id: number, data: UserPayload) => {
      await toast.promise(updateMutation.mutateAsync({ id, data }), {
        loading: "Updating user...",
        success: "User updated successfully",
        error: (error) => api.getApiErrorMessage(error, "Failed to update user"),
      });
    },
    [updateMutation]
  );

  const deleteUser = useCallback(
    async (id: number) => {
      if (!confirm("Are you sure you want to delete this user?")) return;
      await toast.promise(deleteMutation.mutateAsync(id), {
        loading: "Deleting user...",
        success: "User deleted",
        error: (error) => api.getApiErrorMessage(error, "Failed to delete user"),
      });
    },
    [deleteMutation]
  );

  const bulkDeleteUsers = useCallback(
    async (ids: number[]) => {
      if (ids.length === 0) return;
      if (!confirm(`Delete ${ids.length} selected users?`)) return;
      await toast.promise(bulkDeleteMutation.mutateAsync(ids), {
        loading: "Deleting users...",
        success: `${ids.length} users deleted`,
        error: (error) =>
          api.getApiErrorMessage(error, "Some users could not be deleted"),
      });
    },
    [bulkDeleteMutation]
  );

  const kickFromPeriod = useCallback(
    async (user: User) => {
      const registeredPeriod = user.registered_periods?.[0];
      if (!registeredPeriod) {
        toast.error("Mahasiswa belum terdaftar pada periode manapun");
        return;
      }

      const confirmed = confirm(
        `Kick ${user.name} dari periode ${registeredPeriod.name}?\n\n` +
          "Aksi ini akan menghapus registrasi periode, menghapus keanggotaan grup di periode tersebut, dan membatalkan invitation/join request yang masih pending."
      );

      if (!confirmed) return;

      setKickingUserId(user.id);
      await toast.promise(
        kickMutation.mutateAsync({
          periodId: registeredPeriod.id,
          userId: user.id,
        }),
        {
          loading: "Mengeluarkan mahasiswa dari periode...",
          success: (data) =>
            data?.message || "Mahasiswa berhasil dikeluarkan dari periode",
          error: (error) =>
            api.getApiErrorMessage(
              error,
              "Gagal mengeluarkan mahasiswa dari periode"
            ),
        }
      );
    },
    [kickMutation]
  );

  // Backend ApiResponseTrait wraps: { success, message, data: [...], pagination: {...} }
  // paginatedResponse puts data array in .data and pagination in .pagination
  const userData = usersResponse?.data ?? [];
  const paginationInfo = usersResponse?.pagination ?? {};

  return {
    users: Array.isArray(userData) ? userData : [],
    loading,
    pagination: paginationInfo.current_page != null
      ? {
          current_page: paginationInfo.current_page,
          last_page: paginationInfo.last_page,
          per_page: paginationInfo.per_page,
          total: paginationInfo.total,
        }
      : pagination,
    filters,
    setSearch,
    setRole,
    setStatus,
    setSort,
    setPage,
    setPerPage,
    createUser,
    updateUser,
    deleteUser,
    bulkDeleteUsers,
    kickFromPeriod,
    kickingUserId,
  };
}
