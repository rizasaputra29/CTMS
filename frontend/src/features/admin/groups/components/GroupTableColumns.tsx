"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AvatarWithInitials } from "@/components/common/AvatarWithInitials";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableColumn } from "@/components/ui/data-table";
import { getGroupStatusBadgeVariant } from "@/lib/badge-variants";
import {
  Eye,
  Settings,
  Calendar,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { getStatusLabel, canDeleteGroup, reasonMap } from "../lib/utils";
import type { Group, PeriodOption } from "../types";

interface UseGroupColumnsProps {
  periods: PeriodOption[];
  onDelete: (group: Group) => void;
}

export function useGroupColumns({
  periods,
  onDelete,
}: UseGroupColumnsProps): DataTableColumn<Group>[] {
  return [
    { key: "no", header: "No", width: "w-12" },
    {
      key: "leader",
      header: "Group Leader",
      sortable: true,
      render: (group) => {
        const leader = group.members.find((m) => m.is_leader);
        return leader ? (
          <div className="flex items-center gap-3">
            <AvatarWithInitials
              name={leader.student.name}
              size="default"
              className="h-8 w-8"
            />
            <div>
              <span className="font-medium text-sm text-foreground">
                {leader.student.name}
              </span>
              <p className="text-xs text-muted-foreground">
                {leader.student.nim}
              </p>
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">No leader</span>
        );
      },
    },
    {
      key: "period",
      header: "Period",
      sortable: true,
      render: (group) => (
        <span className="text-sm text-muted-foreground">
          {group.period.name}
        </span>
      ),
    },
    {
      key: "title",
      header: "Project Title",
      sortable: true,
      render: (group) => (
        <div className="max-w-[200px]">
          <div
            className="text-sm font-medium line-clamp-2"
            title={group.title?.title || "No title assigned"}
          >
            {group.title?.title || (
              <span className="text-muted-foreground italic">
                No title assigned
              </span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase mt-0.5">
            {group.group_mode}
          </div>
        </div>
      ),
    },
    {
      key: "supervisors",
      header: "Supervisors",
      render: (group) => (
        <div className="text-sm text-muted-foreground">
          {group.supervisions.length > 0 ? (
            group.supervisions.map((s, idx) => (
              <div key={idx} className="text-xs">
                {s.supervisor.name}
              </div>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">Not assigned</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (group) => (
        <Badge
          variant={getGroupStatusBadgeVariant(group.status)}
          className="text-xs font-medium px-2.5 py-0.5"
        >
          {getStatusLabel(group.status, group.status_label)}
        </Badge>
      ),
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      render: (group) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem asChild>
                <Link href={`/admin/groups/${group.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </Link>
              </DropdownMenuItem>
              {group.allowed_actions?.can_manage_finalization ?? true ? (
                <DropdownMenuItem asChild>
                  <Link href={`/admin/finalization?group_id=${group.id}`}>
                    <Settings className="mr-2 h-4 w-4" />
                    Manage Finalization
                  </Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled>
                  <Settings className="mr-2 h-4 w-4" />
                  {reasonMap[group.allowed_actions?.reason || ""] ||
                    "Finalization locked"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href={`/admin/schedule?period_id=${group.period_id}`}>
                  <Calendar className="mr-2 h-4 w-4" />
                  View Schedule
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {canDeleteGroup(group, periods) ? (
                <DropdownMenuItem
                  onClick={() => onDelete(group)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Group
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Group (locked)
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];
}
