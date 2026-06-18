"use client";

import { Fragment } from "react";
import { DataTable } from "@/components/ui/data-table";
import { useExpandableRows } from "@/hooks/use-expandable-rows";
import { Users } from "lucide-react";
import { useGroupColumns, useGroupMemberColumns } from "./GroupColumns";
import type { ReportGroup, PaginationData } from "../types";

interface GroupTableProps {
  groups: ReportGroup[];
  loading: boolean;
  pagination: PaginationData;
  search: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

export function GroupTable({
  groups,
  loading,
  pagination,
  search,
  onSearchChange,
  onPageChange,
  onPerPageChange,
}: GroupTableProps) {
  const { isExpanded, toggleExpanded } = useExpandableRows<number>();
  const columns = useGroupColumns({
    expandedRowId: undefined,
    onToggleExpand: toggleExpanded,
  });
  const memberColumns = useGroupMemberColumns();

  return (
    <DataTable<ReportGroup>
      title="Group Details"
      data={groups}
      columns={columns}
      loading={loading}
      emptyMessage="No groups found"
      emptySubMessage="No groups match your filters."
      emptyIcon={<Users className="h-10 w-10" />}
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search group, title, or student..."
      pagination={pagination}
      onPageChange={onPageChange}
      onPerPageChange={onPerPageChange}
      renderRow={(group, idx, rowNumber) => {
        const expanded = isExpanded(group.id);
        const rowId = group.id;

        return (
          <Fragment key={rowId}>
            <tr className="border-b hover:bg-muted/50 transition-colors">
              <td className="py-3 px-2 text-center">
                {columns
                  .find((c) => c.key === "expand")
                  ?.render?.(group, idx)}
              </td>
              <td className="text-muted-foreground text-sm py-3 px-2">
                {rowNumber}
              </td>
              <td className="py-3 px-2">
                {columns.find((c) => c.key === "code")?.render?.(group, idx)}
              </td>
              <td className="py-3 px-2 text-center">
                {columns
                  .find((c) => c.key === "members_count")
                  ?.render?.(group, idx)}
              </td>
              <td className="py-3 px-2">
                {columns
                  .find((c) => c.key === "supervisor1")
                  ?.render?.(group, idx)}
              </td>
              <td className="py-3 px-2">
                {columns
                  .find((c) => c.key === "supervisor2")
                  ?.render?.(group, idx)}
              </td>
            </tr>
            {expanded && (
              <tr className="bg-muted/30 border-b">
                <td colSpan={6} className="p-4">
                  <div className="space-y-4">
                    {group.title?.description && (
                      <div className="bg-background p-3 rounded-lg border">
                        <p className="text-sm text-muted-foreground">
                          {group.title.description}
                        </p>
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Members ({group.members.length})
                      </h4>
                      <div className="border rounded-lg overflow-hidden bg-background">
                        <DataTable
                          title=""
                          data={group.members}
                          columns={memberColumns}
                          loading={false}
                          emptyMessage="No members"
                          className="border-0"
                        />
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        );
      }}
    />
  );
}
