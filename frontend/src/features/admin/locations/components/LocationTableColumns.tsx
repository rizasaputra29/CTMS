import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Edit, Ellipsis, MapPin, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Location } from "@/features/admin/locations/types";

interface LocationTableColumnsProps {
  onEdit: (location: Location) => void;
  onDelete: (location: Location) => void;
  deleting: number | null;
}

export function locationColumns({
  onEdit,
  onDelete,
  deleting,
}: LocationTableColumnsProps): ColumnDef<Location>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="-ml-3 h-auto cursor-pointer px-3 py-1.5 font-semibold text-gray-700 hover:bg-transparent"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Nama
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const location = row.original;
        return (
          <div className="pl-2">
            <div className="flex items-center gap-2">
              <MapPin
                className={cn(
                  "h-4 w-4",
                  location.is_active ? "text-blue-600" : "text-gray-400"
                )}
              />
              <span
                className={cn(
                  "font-medium",
                  !location.is_active && "text-gray-500"
                )}
              >
                {location.name}
              </span>
            </div>
            {location.description && (
              <p className="mt-0.5 ml-6 text-xs text-gray-500">
                {location.description}
              </p>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      header: "Tipe",
      cell: ({ row }) => (
        <Badge
          variant={row.original.type === "offline" ? "default" : "secondary"}
          className="text-[11px]"
        >
          {row.original.type === "offline" ? "Offline" : "Online"}
        </Badge>
      ),
      filterFn: "equals",
    },
    {
      accessorKey: "capacity",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="-ml-3 h-auto cursor-pointer px-3 py-1.5 font-semibold text-gray-700 hover:bg-transparent"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Kapasitas
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-gray-600">
          {row.original.capacity ? row.original.capacity : "—"}
        </span>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) =>
        row.original.is_active ? (
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
        ),
      filterFn: "equals",
    },
    {
      id: "actions",
      header: () => <div className="text-center">Action</div>,
      cell: ({ row }) => {
        const location = row.original;
        return (
          <div className="text-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={deleting === location.id}
                >
                  <Ellipsis className="h-4 w-4 text-gray-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(location)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(location)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
