import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpDown,
  Edit,
  Ellipsis,
  Trash2,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AssessmentTemplate } from "@/features/admin/assessment-bank/types";

interface AssessmentBankColumnsProps {
  onEdit: (template: AssessmentTemplate) => void;
  onDelete: (template: AssessmentTemplate) => void;
  onToggleActive: (template: AssessmentTemplate) => void;
  deleting: number | null;
}

function getWeightBadgeColor(weight: number): string {
  if (weight > 50) return "bg-red-50 text-red-700 border-red-200";
  if (weight >= 25) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-green-50 text-green-700 border-green-200";
}

export function assessmentBankColumns({
  onEdit,
  onDelete,
  onToggleActive,
  deleting,
}: AssessmentBankColumnsProps): ColumnDef<AssessmentTemplate>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) =>
            table.toggleAllPageRowsSelected(!!value)
          }
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "code",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8 cursor-pointer font-semibold text-gray-700"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Kode
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const template = row.original;
        return (
          <span
            className={cn(
              "font-medium",
              !template.is_active && "text-gray-500"
            )}
          >
            {template.code}
          </span>
        );
      },
    },
    {
      accessorKey: "description",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8 cursor-pointer font-semibold text-gray-700"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Deskripsi
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const template = row.original;
        return (
          <span
            className={cn(
              "text-sm",
              !template.is_active && "text-gray-400"
            )}
          >
            {template.description || "-"}
          </span>
        );
      },
    },
    {
      accessorKey: "is_active",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8 cursor-pointer font-semibold text-gray-700"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const template = row.original;
        return template.is_active ? (
          <Badge
            variant="outline"
            className="border-green-600 text-green-800 hover:bg-green-100"
          >
            <span className="mr-0.5 h-1.5 w-1.5 rounded-full bg-green-600" />
            Aktif
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-gray-600 text-gray-600 hover:bg-gray-200"
          >
            <span className="mr-0.5 h-1.5 w-1.5 rounded-full bg-gray-400" />
            Nonaktif
          </Badge>
        );
      },
      filterFn: "equals",
    },
    {
      accessorKey: "weight",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8 cursor-pointer font-semibold text-gray-700"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Bobot
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={cn("text-xs", getWeightBadgeColor(row.original.weight))}
        >
          {row.original.weight}%
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => (
        <span className="font-semibold text-gray-700">Action</span>
      ),
      cell: ({ row }) => {
        const template = row.original;
        const isDeleting = deleting === template.id;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                disabled={isDeleting}
              >
                <Ellipsis className="h-4 w-4 text-gray-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(template)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleActive(template)}>
                {template.is_active ? (
                  <>
                    <Archive className="mr-2 h-4 w-4" />
                    Nonaktifkan
                  </>
                ) : (
                  <>
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                    Aktifkan
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(template)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
