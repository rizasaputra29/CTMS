"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldCheck } from "lucide-react";
import { useGroups } from "../hooks/use-groups";
import { useGroupColumns } from "./GroupTableColumns";
import { GroupTable } from "./GroupTable";
import type { Group, SortKey, SortDir } from "../types";

export function GroupsFeature() {
  const {
    groups,
    periods,
    loading,
    pagination,
    selectedPeriod,
    setSelectedPeriod,
    fetchData,
    deleteGroup,
  } = useGroups();

  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("leader");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleDeleteClick = useCallback((group: Group) => {
    setGroupToDelete(group);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!groupToDelete) return;
    setDeleteLoading(true);
    try {
      await deleteGroup(groupToDelete);
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
      setGroupToDelete(null);
    }
  }, [groupToDelete, deleteGroup]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const handlePageChange = useCallback(
    (page: number) => {
      if (page >= 1 && page <= pagination.last_page) {
        fetchData(page);
      }
    },
    [fetchData, pagination.last_page]
  );

  const handlePerPageChange = useCallback(
    (pp: number) => {
      fetchData(1, pp);
    },
    [fetchData]
  );

  const columns = useGroupColumns({ periods, onDelete: handleDeleteClick });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-[32px] font-semibold text-grey-600 leading-tight">
            Group Management
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/admin/finalization">
            <Button size="sm">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Finalization
            </Button>
          </Link>
        </div>
      </div>

      <GroupTable
        groups={groups}
        periods={periods}
        loading={loading}
        pagination={pagination}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        onPageChange={handlePageChange}
        onPerPageChange={handlePerPageChange}
        columns={columns}
        onDelete={handleDeleteClick}
      />

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Group #{groupToDelete?.id}? This
              action cannot be undone.
              <br />
              <br />
              This will:
              <ul className="list-disc ml-5 mt-2 text-sm text-muted-foreground">
                <li>
                  Remove all {groupToDelete?.members?.length || 0} member(s)
                  from the group
                </li>
                <li>Delete all bids, proposals, and documents</li>
                <li>Remove supervisor assignments</li>
                <li>Allow students to register for new periods</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setGroupToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? "Deleting..." : "Delete Group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
