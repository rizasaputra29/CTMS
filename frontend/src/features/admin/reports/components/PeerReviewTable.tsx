"use client";

import { DataTable } from "@/components/ui/data-table";
import { Star, Filter, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePeerReviewColumns } from "./PeerReviewColumns";
import type { PeerReview, PaginationData } from "../types";

type SortField = "created_at" | "reviewer" | "reviewee" | "raw_score" | "score";

interface PeerReviewTableProps {
  reviews: PeerReview[];
  loading: boolean;
  pagination: PaginationData;
  search: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  sortBy: SortField;
  sortOrder: "asc" | "desc";
  onSortChange: (field: SortField) => void;
  periodId?: string;
  onCreateReview?: () => void;
}

const sortFieldLabels: Record<SortField, string> = {
  created_at: "Date",
  reviewer: "Reviewer",
  reviewee: "Reviewee",
  raw_score: "Raw Score",
  score: "Score",
};

export function PeerReviewTable({
  reviews,
  loading,
  pagination,
  search,
  onSearchChange,
  onPageChange,
  onPerPageChange,
  sortBy,
  sortOrder,
  onSortChange,
  periodId,
  onCreateReview,
}: PeerReviewTableProps) {
  const columns = usePeerReviewColumns();

  const handleSortClick = () => {
    const sortFields: SortField[] = ["created_at", "reviewer", "reviewee", "score"];
    const currentIndex = sortFields.indexOf(sortBy);
    const nextIndex = (currentIndex + 1) % sortFields.length;
    onSortChange(sortFields[nextIndex]);
  };

  return (
    <DataTable<PeerReview>
      title="Peer Reviews"
      data={reviews}
      columns={columns}
      loading={loading}
      emptyMessage="No peer reviews found"
      emptySubMessage="No peer reviews match your search criteria."
      emptyIcon={<Star className="h-10 w-10" />}
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search reviewer or reviewee..."
      sortKey={sortBy}
      sortDir={sortOrder}
      onSort={(key) => onSortChange(key as SortField)}
      filterSlot={
        <button
          onClick={handleSortClick}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Filter className="h-4 w-4" />
          <span>
            Sort by {sortFieldLabels[sortBy]} {sortOrder === "asc" ? "↑" : "↓"}
          </span>
        </button>
      }
      actions={
        reviews.length === 0 && onCreateReview ? (
          <Button onClick={onCreateReview} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Create First Review
          </Button>
        ) : undefined
      }
      pagination={pagination}
      onPageChange={onPageChange}
      onPerPageChange={onPerPageChange}
    />
  );
}
