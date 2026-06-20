"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  FileText,
  Presentation,
  GraduationCap,
  Upload,
} from "lucide-react";
import { useDocumentUploads } from "../hooks/use-document-uploads";
import { useDocumentUploadsColumns } from "./DocumentUploadsTableColumns";
import { DocumentUploadsTable } from "./DocumentUploadsTable";
import type { DocumentUpload } from "../types";

export function DocumentUploadsFeature() {
  const {
    groups,
    summary,
    periods,
    loading,
    summaryLoading,
    pagination,
    filters,
    setFilters,
    onPageChange,
    onPerPageChange,
    downloadDocument,
  } = useDocumentUploads();

  const handleDownload = (document: DocumentUpload) => {
    downloadDocument(document);
  };

  const columns = useDocumentUploadsColumns();

  const stats = [
    {
      title: "Groups with Uploads",
      value: summary?.groups_with_uploads || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Students with Uploads",
      value: summary?.students_with_uploads || 0,
      icon: Users,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
    },
    {
      title: "Phase Documents",
      value: summary?.phase_documents || 0,
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Expo Documents",
      value: summary?.expo_documents || 0,
      icon: Presentation,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "TA Documents",
      value: summary?.ta_documents || 0,
      icon: GraduationCap,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Total Documents",
      value: summary?.total_documents || 0,
      icon: Upload,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-[32px] font-semibold text-grey-600 leading-tight">
            Document Uploads
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage all documents uploaded by mahasiswa across all
            sources
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2 rounded-md ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <DocumentUploadsTable
        groups={groups}
        periods={periods}
        loading={loading}
        pagination={pagination}
        filters={filters}
        onFiltersChange={setFilters}
        onPageChange={onPageChange}
        onPerPageChange={onPerPageChange}
        columns={columns}
        onDownload={handleDownload}
      />
    </div>
  );
}
