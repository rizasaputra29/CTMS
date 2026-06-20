"use client";

import { Fragment } from "react";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
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
import {
  ChevronDown,
  ChevronUp,
  Users,
  Filter,
  FileText,
  Download,
  Crown,
  Mail,
  Calendar,
  Presentation,
  GraduationCap,
} from "lucide-react";
import type {
  GroupDocumentUpload,
  DocumentUpload,
  PeriodOption,
  PaginationData,
  DocumentFilters,
  DocumentSource,
} from "../types";

interface DocumentUploadsTableProps {
  groups: GroupDocumentUpload[];
  periods: PeriodOption[];
  loading: boolean;
  pagination: PaginationData;
  filters: DocumentFilters;
  onFiltersChange: (filters: DocumentFilters) => void;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  columns: DataTableColumn<GroupDocumentUpload>[];
  onDownload: (document: DocumentUpload) => void;
}

const sourceOptions: { value: DocumentSource | "all"; label: string }[] = [
  { value: "all", label: "All Sources" },
  { value: "phase_documents", label: "Phase Documents" },
  { value: "expo_documents", label: "Expo Documents" },
  { value: "ta_documents", label: "TA Documents" },
];

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "PENDING", label: "Pending" },
];

const sourceIcons = {
  phase_documents: FileText,
  expo_documents: Presentation,
  ta_documents: GraduationCap,
};

const sourceColors = {
  phase_documents: "bg-blue-100 text-blue-800",
  expo_documents: "bg-purple-100 text-purple-800",
  ta_documents: "bg-green-100 text-green-800",
};

function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toUpperCase()) {
    case "APPROVED":
      return "default";
    case "SUBMITTED":
      return "secondary";
    case "REJECTED":
      return "destructive";
    case "PENDING":
      return "outline";
    default:
      return "secondary";
  }
}

export function DocumentUploadsTable({
  groups,
  periods,
  loading,
  pagination,
  filters,
  onFiltersChange,
  onPageChange,
  onPerPageChange,
  columns,
  onDownload,
}: DocumentUploadsTableProps) {
  const { isExpanded, toggleExpanded } = useExpandableRows<number>();

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value });
  };

  const handlePeriodChange = (value: string) => {
    onFiltersChange({ ...filters, period_id: value });
  };

  const handleSourceChange = (value: DocumentSource | "all") => {
    onFiltersChange({ ...filters, source: value });
  };

  const handleStatusChange = (value: string) => {
    onFiltersChange({ ...filters, status: value });
  };

  return (
    <DataTable<GroupDocumentUpload>
      title="Document Uploads"
      data={groups}
      columns={columns}
      loading={loading}
      emptyMessage="No groups with document uploads found"
      emptySubMessage="Try adjusting your search or filter."
      emptyIcon={<FileText className="h-10 w-10" />}
      searchValue={filters.search || ""}
      onSearchChange={handleSearchChange}
      searchPlaceholder="Search by group code or member name..."
      filterSlot={
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" /> Period
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
                Period
              </div>
              <DropdownMenuItem
                onClick={() => handlePeriodChange("all")}
                className={filters.period_id === "all" ? "bg-accent" : ""}
              >
                All Periods
              </DropdownMenuItem>
              {periods.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => handlePeriodChange(p.id.toString())}
                  className={
                    filters.period_id === p.id.toString() ? "bg-accent" : ""
                  }
                >
                  {p.name} {p.is_active && "(Active)"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" /> Source
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
                Document Source
              </div>
              {sourceOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => handleSourceChange(option.value)}
                  className={
                    filters.source === option.value ? "bg-accent" : ""
                  }
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" /> Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
                Status
              </div>
              {statusOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => handleStatusChange(option.value)}
                  className={
                    filters.status === option.value ? "bg-accent" : ""
                  }
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
      pagination={pagination}
      onPageChange={onPageChange}
      onPerPageChange={onPerPageChange}
      renderRow={(group, idx, rowNumber) => {
        const expanded = isExpanded(group.group_id);
        return (
          <Fragment key={group.group_id}>
            <tr
              className="group cursor-pointer hover:bg-muted/50 transition-colors border-b data-[state=selected]:bg-muted"
              onClick={() => toggleExpanded(group.group_id)}
            >
              <td className="w-12 py-3 px-2">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(group.group_id);
                    }}
                  >
                    {expanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  <span className="text-muted-foreground text-sm">
                    {rowNumber}
                  </span>
                </div>
              </td>
              <td className="py-3 px-2">
                {columns.find((c) => c.key === "group_code")?.render?.(group, idx)}
              </td>
              <td className="py-3 px-2">
                {columns.find((c) => c.key === "members")?.render?.(group, idx)}
              </td>
              <td className="py-3 px-2">
                {columns.find((c) => c.key === "phase_documents_count")?.render?.(group, idx)}
              </td>
              <td className="py-3 px-2">
                {columns.find((c) => c.key === "expo_documents_count")?.render?.(group, idx)}
              </td>
              <td className="py-3 px-2">
                {columns.find((c) => c.key === "ta_documents_count")?.render?.(group, idx)}
              </td>
              <td className="py-3 px-2">
                {columns.find((c) => c.key === "total_documents")?.render?.(group, idx)}
              </td>
              <td className="py-3 px-2">
                {columns.find((c) => c.key === "latest_upload_at")?.render?.(group, idx)}
              </td>
            </tr>
            {expanded && (
              <tr className="bg-muted/30 hover:bg-muted/30 border-b">
                <td colSpan={9} className="p-4">
                  <div className="space-y-6">
                    {/* Members Section */}
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
                              name={member.name}
                              size="default"
                              className="h-10 w-10"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <p className="font-medium text-sm">
                                  {member.name}
                                </p>
                                {member.is_leader && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1 py-0 h-4"
                                  >
                                    <Crown className="h-2.5 w-2.5 mr-0.5" />
                                    Leader
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                NIM: {member.nim || "N/A"}
                              </p>
                              {member.email && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <Mail className="h-3 w-3" />
                                  {member.email}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Documents Section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        Uploaded Documents ({group.documents.length})
                      </div>
                      <div className="rounded-lg border bg-background shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                                Student
                              </th>
                              <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                                Source
                              </th>
                              <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                                Document
                              </th>
                              <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                                Status
                              </th>
                              <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                                Date
                              </th>
                              <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.documents.map((doc) => {
                              const Icon = sourceIcons[doc.source] || FileText;
                              return (
                                <tr
                                  key={`${doc.source}-${doc.id}`}
                                  className="border-b last:border-b-0 hover:bg-muted/30"
                                >
                                  <td className="py-2.5 px-3">
                                    {doc.student ? (
                                      <div className="flex items-center gap-2">
                                        <AvatarWithInitials
                                          name={doc.student.name}
                                          size="default"
                                          className="h-7 w-7"
                                        />
                                        <div>
                                          <span className="font-medium text-sm">
                                            {doc.student.name}
                                          </span>
                                          {doc.student.nim && (
                                            <p className="text-xs text-muted-foreground">
                                              {doc.student.nim}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-sm">
                                        Unknown
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <Badge
                                      variant="outline"
                                      className={`flex items-center gap-1 w-fit ${sourceColors[doc.source] || ""}`}
                                    >
                                      <Icon className="h-3 w-3" />
                                      <span className="text-xs">
                                        {doc.source_label}
                                      </span>
                                    </Badge>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="max-w-[200px]">
                                      <div
                                        className="text-sm font-medium truncate"
                                        title={doc.original_name}
                                      >
                                        {doc.original_name}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {doc.document_type}
                                        {doc.phase && doc.phase !== "TA" && (
                                          <span className="ml-1">
                                            ({doc.phase})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <Badge
                                      variant={getStatusBadgeVariant(doc.status)}
                                      className="text-xs font-medium"
                                    >
                                      {doc.status}
                                    </Badge>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {new Date(
                                        doc.uploaded_at
                                      ).toLocaleDateString("id-ID", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDownload(doc);
                                      }}
                                      title="Download document"
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
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
