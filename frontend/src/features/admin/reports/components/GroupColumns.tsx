"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumn } from "@/components/ui/data-table";
import { ChevronDown, ChevronUp, Crown, Mail, Users } from "lucide-react";
import type { ReportGroup, GroupMember } from "../types";

interface UseGroupColumnsProps {
  expandedRowId?: number | null;
  onToggleExpand?: (id: number) => void;
}

export function useGroupColumns({
  expandedRowId,
  onToggleExpand,
}: UseGroupColumnsProps = {}): DataTableColumn<ReportGroup>[] {
  return [
    {
      key: "expand",
      header: "",
      width: "w-12",
      align: "center",
      render: (group) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand?.(group.id);
          }}
        >
          {expandedRowId === group.id ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      ),
    },
    {
      key: "code",
      header: "Group",
      sortable: true,
      render: (group) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">
              {group.code || `Group ${group.id}`}
            </span>
            <Badge
              variant={group.status === "ACTIVE" ? "default" : "secondary"}
            >
              {group.status}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {group.group_mode}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {group.title?.title || "No title"}
          </div>
        </div>
      ),
    },
    {
      key: "members_count",
      header: "Members",
      align: "center",
      sortable: true,
      render: (group) => (
        <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
          <Users className="h-4 w-4" />
          {group.members_count}
        </span>
      ),
    },
    {
      key: "supervisor1",
      header: "Supervisor 1",
      render: (group) => (
        <div className="text-sm">
          {group.supervisor1 ? (
            <div>
              <div className="font-medium">{group.supervisor1.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {group.supervisor1.email}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground italic text-xs">
              Not assigned
            </span>
          )}
        </div>
      ),
    },
    {
      key: "supervisor2",
      header: "Supervisor 2",
      render: (group) => (
        <div className="text-sm">
          {group.supervisor2 ? (
            <div>
              <div className="font-medium">{group.supervisor2.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {group.supervisor2.email}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground italic text-xs">
              Not assigned
            </span>
          )}
        </div>
      ),
    },
  ];
}

export function useGroupMemberColumns(): DataTableColumn<GroupMember>[] {
  return [
    {
      key: "nim",
      header: "NIM",
      render: (member) => (
        <span className="font-mono text-sm">{member.student.nim}</span>
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (member) => (
        <div className="font-medium text-sm flex items-center gap-2">
          {member.student.name}
          {member.is_leader && (
            <Badge variant="default" className="text-xs">
              <Crown className="h-3 w-3 mr-1" />
              Leader
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (member) => (
        <span className="text-sm text-muted-foreground">
          {member.student.email}
        </span>
      ),
    },
  ];
}
