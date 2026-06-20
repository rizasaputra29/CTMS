"use client";

import { Badge } from "@/components/ui/badge";
import { AvatarWithInitials } from "@/components/common/AvatarWithInitials";
import { DataTableColumn } from "@/components/ui/data-table";
import {
  FileText,
  Presentation,
  GraduationCap,
  Crown,
} from "lucide-react";
import type { GroupDocumentUpload } from "../types";

export function useDocumentUploadsColumns(): DataTableColumn<GroupDocumentUpload>[] {
  return [
    { key: "no", header: "No", width: "w-12" },
    {
      key: "group_code",
      header: "Group",
      sortable: true,
      render: (group) => (
        <div className="text-sm">
          <span className="font-medium">{group.group_code}</span>
          {group.period && (
            <p className="text-xs text-muted-foreground">{group.period.name}</p>
          )}
        </div>
      ),
    },
    {
      key: "members",
      header: "Members",
      render: (group) => {
        const members = group.members || [];
        const leader = members.find((m) => m.is_leader);
        const otherCount = members.length - 1;

        return (
          <div className="flex items-center gap-3">
            <AvatarWithInitials
              name={leader?.name || members[0]?.name || "Unknown"}
              size="default"
              className="h-8 w-8"
            />
            <div>
              <div className="flex items-center gap-1">
                <span className="font-medium text-sm text-foreground">
                  {leader?.name || members[0]?.name || "Unknown"}
                </span>
                {leader && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1 py-0 h-4"
                  >
                    <Crown className="h-2.5 w-2.5 mr-0.5" />
                    Leader
                  </Badge>
                )}
              </div>
              {otherCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  +{otherCount} other{otherCount > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "phase_documents_count",
      header: "Phase Docs",
      align: "center",
      render: (group) => (
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-700 border-blue-200"
        >
          <FileText className="h-3 w-3 mr-1" />
          {group.phase_documents_count}
        </Badge>
      ),
    },
    {
      key: "expo_documents_count",
      header: "Expo Docs",
      align: "center",
      render: (group) => (
        <Badge
          variant="outline"
          className="bg-purple-50 text-purple-700 border-purple-200"
        >
          <Presentation className="h-3 w-3 mr-1" />
          {group.expo_documents_count}
        </Badge>
      ),
    },
    {
      key: "ta_documents_count",
      header: "TA Docs",
      align: "center",
      render: (group) => (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 border-green-200"
        >
          <GraduationCap className="h-3 w-3 mr-1" />
          {group.ta_documents_count}
        </Badge>
      ),
    },
    {
      key: "total_documents",
      header: "Total",
      align: "center",
      sortable: true,
      render: (group) => (
        <span className="font-semibold text-sm">{group.total_documents}</span>
      ),
    },
    {
      key: "latest_upload_at",
      header: "Latest Upload",
      sortable: true,
      render: (group) => {
        const date = new Date(group.latest_upload_at);
        return (
          <div className="text-sm text-muted-foreground">
            {date.toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
            <div className="text-xs">
              {date.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        );
      },
    },
  ];
}
