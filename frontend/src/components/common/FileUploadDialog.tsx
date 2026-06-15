"use client";

import { useState, useCallback } from "react";
import { Upload, FileWarning, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MAX_FILE_SIZE,
  ALLOWED_DOCUMENT_EXTENSIONS,
} from "@/lib/constants";

export interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  accept?: string;
  maxSize?: number;
  allowedExtensions?: readonly string[];
  onUpload: (file: File) => Promise<void> | void;
  loading?: boolean;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

/**
 * Reusable file upload dialog with validation.
 */
export function FileUploadDialog({
  open,
  onOpenChange,
  title = "Upload File",
  description = "Select a file to upload.",
  accept = ".pdf,.doc,.docx,.ppt,.pptx",
  maxSize = MAX_FILE_SIZE,
  allowedExtensions = ALLOWED_DOCUMENT_EXTENSIONS,
  onUpload,
  loading = false,
}: FileUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const selected = e.target.files?.[0];
      if (!selected) {
        setFile(null);
        return;
      }

      const ext = `.${selected.name.split(".").pop()?.toLowerCase()}`;
      if (!allowedExtensions.includes(ext)) {
        setError(
          `Invalid file type. Allowed: ${allowedExtensions.join(", ")}`
        );
        setFile(null);
        return;
      }

      if (selected.size > maxSize) {
        setError(`File too large. Maximum size: ${formatBytes(maxSize)}`);
        setFile(null);
        return;
      }

      setFile(selected);
    },
    [allowedExtensions, maxSize]
  );

  const handleUpload = useCallback(async () => {
    if (!file) return;
    try {
      await onUpload(file);
      setFile(null);
      setError(null);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }, [file, onUpload, onOpenChange]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setFile(null);
        setError(null);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 transition-colors hover:bg-muted/50",
              error && "border-destructive bg-destructive/5"
            )}
          >
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">
              {file ? file.name : "Click to select a file"}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              Max {formatBytes(maxSize)} • {accept}
            </span>
            <input
              type="file"
              accept={accept}
              className="sr-only"
              onChange={handleFileChange}
              disabled={loading}
            />
          </label>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <FileWarning className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
