"use client";

import { Fragment, useMemo } from "react";
import {
  DataTable,
  DataTableColumn,
} from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AvatarWithInitials } from "@/components/common/AvatarWithInitials";
import { useExpandableRows } from "@/hooks/use-expandable-rows";
import { ChevronDown, ChevronUp, Crown, Mail, Users, Filter } from "lucide-react";
import { formatDate } from "../lib/utils";
import type { Group, PeriodOption, PaginationData, SortKey, SortDir } from "../types";

interface GroupTableProps {
  groups: Group[];
  periods: PeriodOption[];
  loading: boolean;
  pagination: PaginationData;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedPeriod: string;
  onPeriodChange: (value: string) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  columns: DataTableColumn<Group>[];
  onDelete: (group: Group) => void;
}

export function GroupTable({
  groups,
  periods,
  loading,
  pagination,
  searchQuery,
  onSearchChange,
  selectedPeriod,
  onPeriodChange,
  sortKey,
  sortDir,
  onSort,
  onPageChange,
  onPerPageChange,
  columns,
  onDelete: _onDelete,
}: GroupTableProps) {
  const { isExpanded, toggleExpanded } = useExpandableRows<number>();

  const filteredGroups = useMemo(() => {
    return groups.filter((group) => {
      const query = searchQuery.toLowerCase();
      return (
        group.members.some((m) =>
          m.student.name.toLowerCase().includes(query)
        ) ||
        group.title?.title.toLowerCase().includes(query) ||
        false ||
        group.period.name.toLowerCase().includes(query)
      );
    });
  }, [groups, searchQuery]);

  const sortedGroups = useMemo(() => {
    const data = [...filteredGroups].sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case "leader":
          const leaderA = a.members.find((m) => m.is_leader)?.student.name || "";
          const leaderB = b.members.find((m) => m.is_leader)?.student.name || "";
          comparison = leaderA.localeCompare(leaderB);
          break;
        case "period":
          comparison = a.period.name.localeCompare(b.period.name);
          break;
        case "title":
          const titleA = a.title?.title || "";
          const titleB = b.title?.title || "";
          comparison = titleA.localeCompare(titleB);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === "asc" ? comparison : -comparison;
    });
    return data;
  }, [filteredGroups, sortKey, sortDir]);

  return (
    <DataTable<Group>
      title="Group Table"
      data={sortedGroups}
      columns={columns}
      loading={loading}
      emptyMessage="No groups found"
      emptySubMessage="Try adjusting your search or filter."
      emptyIcon={<Users className="h-10 w-10" />}
      searchValue={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search..."
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
              Period
            </div>
            <DropdownMenuItem
              onClick={() => onPeriodChange("all")}
              className={selectedPeriod === "all" ? "bg-accent" : ""}
            >
              All Periods
            </DropdownMenuItem>
            {periods.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => onPeriodChange(p.id.toString())}
                className={
                  selectedPeriod === p.id.toString() ? "bg-accent" : ""
                }
              >
                {p.name} {p.is_active && "(Active)"}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      }
      pagination={pagination}
      onPageChange={onPageChange}
      onPerPageChange={onPerPageChange}
      renderRow={(group, idx, rowNumber) => {
        const expanded = isExpanded(group.id);
        return (
          <Fragment key={group.id}>
            <tr
              className="group cursor-pointer hover:bg-muted/50 transition-colors border-b data-[state=selected]:bg-muted"
              onClick={() => toggleExpanded(group.id)}
            >
              <td
                className="w-10 py-3 px-2"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded(group.id);
                  }}
                >
                  {expanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </td>
              <td className="text-muted-foreground text-sm py-3 px-2">
                {rowNumber}
              </td>
              <td className="py-3 px-2">
                {columns.find((c) => c.key === "leader")?.render?.(group, idx)}
              </td>
              <td className="py-3 px-2">
                {columns.find((c) => c.key === "period")?.render?.(group, idx)}
              </td>
              <td className="py-3 px-2">
                {columns.find((c) => c.key === "title")?.render?.(group, idx)}
              </td>
              <td className="py-3 px-2">
                {columns
                  .find((c) => c.key === "supervisors")
                  ?.render?.(group, idx)}
              </td>
              <td className="py-3 px-2">
                {columns.find((c) => c.key === "status")?.render?.(group, idx)}
              </td>
              <td
                className="text-right py-3 px-2"
                onClick={(e) => e.stopPropagation()}
              >
                {columns.find((c) => c.key === "action")?.render?.(group, idx)}
              </td>
            </tr>
            {expanded && (
              <tr className="bg-muted/30 hover:bg-muted/30 border-b">
                <td colSpan={8} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Users className="h-4 w-4" />
                      All Members ({group.members.length})
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {group.members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-start gap-3 p-3 bg-background rounded-lg border shadow-sm"
                        >
                          <AvatarWithInitials
                            name={member.student.name}
                            size="default"
                            className="h-10 w-10"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm truncate">
                                {member.student.name}
                              </p>
                              {member.is_leader && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] h-5 px-1.5"
                                >
                                  <Crown className="h-3 w-3 mr-1 text-yellow-500" />
                                  Leader
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {member.student.nim}
                            </p>
                            {member.student.email && (
                              <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                <Mail className="h-3 w-3" />
                                {member.student.email}
                              </p>
                            )}
                            {member.joined_at && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                Joined: {formatDate(member.joined_at)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
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
