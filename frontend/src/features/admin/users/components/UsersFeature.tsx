"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Upload, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { userSchema, type UserFormData } from "@/lib/validations/user";
import {
  useUsers,
  useUserColumns,
  UserTable,
  UserFormDialog,
  type User,
} from "@/features/admin/users";

export function UsersFeature() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const {
    users,
    loading,
    pagination,
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
  } = useUsers();

  const schema = useMemo(
    () =>
      editingUser
        ? userSchema
        : userSchema.extend({
            password: z.string().min(8, "Password must be at least 8 characters"),
          }),
    [editingUser]
  );

  const form = useForm<UserFormData>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      roles: ["mahasiswa"],
      nim: "",
    },
  });

  const resetForm = useCallback(() => {
    setEditingUser(null);
    form.reset({
      name: "",
      email: "",
      password: "",
      roles: ["mahasiswa"],
      nim: "",
    });
  }, [form]);

  const startEdit = useCallback(
    (user: User) => {
      setEditingUser(user);
      form.reset({
        name: user.name,
        email: user.email,
        password: "",
        roles: (user.roles?.map((r) => r.slug) || [
          user.role,
        ]) as ("admin" | "dosen" | "mahasiswa")[],
        nim: user.nim || "",
      });
      setOpen(true);
    },
    [form]
  );

  const onSubmit = useCallback(
    async (data: UserFormData) => {
      if (
        data.roles.includes("mahasiswa") &&
        (!data.nim || data.nim.length < 8)
      ) {
        toast.error(
          "NIM is required for mahasiswa role and must be at least 8 characters"
        );
        return;
      }

      const payload = {
        name: data.name,
        email: data.email,
        roles: data.roles,
        password: data.password || undefined,
        nim: data.roles.includes("mahasiswa") && data.nim ? data.nim : undefined,
      };

      try {
        if (editingUser) {
          await updateUser(editingUser.id, payload);
        } else {
          await createUser(payload);
        }
        setOpen(false);
        resetForm();
      } catch {
        // Error toast is already shown by the hook.
      }
    },
    [editingUser, createUser, updateUser, resetForm]
  );

  const allSelected = useMemo(() => {
    if (users.length === 0) return false;
    return users.every((u) => selectedIds.has(u.id));
  }, [users, selectedIds]);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map((u) => u.id)));
    }
  }, [allSelected, users]);

  const toggleSelectOne = useCallback((id: number | string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(Number(id))) next.delete(Number(id));
      else next.add(Number(id));
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(async () => {
    await bulkDeleteUsers(Array.from(selectedIds));
    setSelectedIds(new Set());
  }, [bulkDeleteUsers, selectedIds]);

  const columns = useUserColumns({
    kickingUserId,
    onView: (user) => router.push(`/admin/users/${user.id}`),
    onEdit: startEdit,
    onDelete: deleteUser,
    onKick: kickFromPeriod,
  });

  const headerAction = (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.info("Import Users - Coming Soon")}
      >
        <Upload className="mr-2 h-4 w-4" /> Import Users
      </Button>
      <Button onClick={() => setOpen(true)} size="sm">
        <UserPlus className="mr-2 h-4 w-4" /> Tambah User
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        action={headerAction}
      />

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/50 px-4 py-2">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} user{selectedIds.size > 1 ? "s" : ""} selected
          </span>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            Delete Selected
          </Button>
        </div>
      )}

      <UserTable
        users={users}
        loading={loading}
        pagination={pagination}
        search={filters.search}
        onSearchChange={setSearch}
        activeTab={filters.role}
        onTabChange={setRole}
        statusFilter={filters.status}
        onStatusChange={setStatus}
        sortKey={filters.sortKey}
        sortDir={filters.sortDir}
        onSort={setSort}
        onPageChange={setPage}
        onPerPageChange={setPerPage}
        columns={columns}
        onRowClick={(user) => router.push(`/admin/users/${user.id}`)}
        selectedIds={selectedIds}
        onToggleSelectAll={toggleSelectAll}
        onToggleSelectOne={toggleSelectOne}
      />

      <UserFormDialog
        open={open}
        onOpenChange={(val) => {
          setOpen(val);
          if (!val) resetForm();
        }}
        editing={editingUser}
        form={form}
        onSubmit={onSubmit}
      />
    </div>
  );
}
