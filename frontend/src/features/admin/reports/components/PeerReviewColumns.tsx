"use client";

import { DataTableColumn } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";
import type { PeerReview } from "../types";

const getScoreColor = (score: number): string => {
  if (score >= 85) return "text-emerald-600";
  if (score >= 70) return "text-blue-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
};

const getRawScoreColor = (score: number): string => {
  if (score >= 3) return "text-emerald-600";
  if (score >= 2) return "text-amber-600";
  return "text-red-600";
};

export function usePeerReviewColumns(): DataTableColumn<PeerReview>[] {
  return [
    {
      key: "created_at",
      header: "Date",
      sortable: true,
      render: (review) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDate(review.created_at)}
        </span>
      ),
    },
    {
      key: "group",
      header: "Group",
      render: (review) => (
        <span className="font-medium text-sm">
          {review.group?.title?.title ||
            review.group?.code ||
            `Group ${review.group?.id}`}
        </span>
      ),
    },
    {
      key: "reviewer",
      header: "Reviewer",
      sortable: true,
      render: (review) => (
        <span className="text-sm">{review.reviewer?.name || "N/A"}</span>
      ),
    },
    {
      key: "reviewee",
      header: "Reviewee",
      sortable: true,
      render: (review) => (
        <span className="text-sm">{review.reviewee?.name || "N/A"}</span>
      ),
    },
    {
      key: "indicator",
      header: "Indicator",
      render: (review) => (
        <div>
          <div className="text-sm">
            {review.periodIndicator?.template?.name || "N/A"}
          </div>
          <div className="text-xs text-muted-foreground">
            {review.periodIndicator?.template?.code}
          </div>
        </div>
      ),
    },
    {
      key: "raw_score",
      header: "Raw (1-4)",
      align: "right",
      sortable: true,
      render: (review) => (
        <span className={`font-bold ${getRawScoreColor(review.raw_score)}`}>
          {review.raw_score}
        </span>
      ),
    },
    {
      key: "score",
      header: "Score (0-100)",
      align: "right",
      sortable: true,
      render: (review) => (
        <span className={`font-bold ${getScoreColor(review.score)}`}>
          {review.score}
        </span>
      ),
    },
    {
      key: "comment",
      header: "Comment",
      render: (review) => (
        <span
          className="text-sm text-muted-foreground max-w-xs truncate block"
          title={review.comment || ""}
        >
          {review.comment || "-"}
        </span>
      ),
    },
  ];
}
