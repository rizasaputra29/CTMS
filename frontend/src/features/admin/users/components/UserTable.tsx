"use client";


import {
  DataTable,
  DataTableColumn,
} from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Filter, Users } from "lucide-react";
import type { RoleTab } from "@/types/guards";
import type { User, PaginationData, SortKey, SortDir, StatusFilter } from "../types";

interface UserTableProps {
  users: User[];
  loading: boolean;
  pagination: PaginationData;
  search: string;
  onSearchChange: (value: string) => void;
  activeTab: RoleTab;
  onTabChange: (tab: RoleTab) => void;
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  columns: DataTableColumn<User>[];
  onRowClick: (user: User) => void;
  selectedIds: Set<number>;
  onToggleSelectAll: () => void;
  onToggleSelectOne: (id: number | string) => void;
}

const ROLE_TABS: { value: RoleTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mahasiswa", label: "Mahasiswa" },
  { value: "dosen", label: "Dosen" },
  { value: "admin", label: "Admin" },
];

export function UserTable({
  users,
  loading,
  pagination,
  search,
  onSearchChange,
  activeTab,
  onTabChange,
  statusFilter,
  onStatusChange,
  sortKey,
  sortDir,
  onSort,
  onPageChange,
  onPerPageChange,
  columns,
  onRowClick,
  selectedIds,
  onToggleSelectAll,
  onToggleSelectOne,
}: UserTableProps) {
  return (
    <DataTable<User>
      title="User Table"
      data={users}
      columns={columns}
      loading={loading}
      emptyMessage="No users found"
      emptySubMessage="Try adjusting your search or filter."
      emptyIcon={<Users className="h-10 w-10" />}
      showCheckbox
      selectedIds={selectedIds}
      onToggleSelectAll={onToggleSelectAll}
      onToggleSelectOne={onToggleSelectOne}
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search"
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={(key) => onSort(key as SortKey)}
      filterSlot={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" /> Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
              Role
            </div>
            {ROLE_TABS.map((tab) => (
              <DropdownMenuItem
                key={tab.value}
                onClick={() => onTabChange(tab.value)}
                className={activeTab === tab.value ? "bg-accent" : ""}
              >
                {tab.label}
              </DropdownMenuItem>
            ))}
            <div className="my-1 h-px bg-border" />
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
              Status
            </div>
            {(
              [
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ] as { value: StatusFilter; label: string }[]
            ).map((status) => (
              <DropdownMenuItem
                key={status.value}
                onClick={() => onStatusChange(status.value)}
                className={statusFilter === status.value ? "bg-accent" : ""}
              >
                {status.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      }
      pagination={pagination}
      onPageChange={onPageChange}
      onPerPageChange={onPerPageChange}
      rowClickable
      onRowClick={onRowClick}
    />
  );
}
