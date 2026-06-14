import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Edit,
  Trash2,
  FileText,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Period } from "@/features/admin/periods/types";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy", { locale: id });
  } catch {
    return dateStr;
  }
}

interface PeriodExpandedContentProps {
  period: Period;
}

export function PeriodExpandedContent({ period }: PeriodExpandedContentProps) {
  const hasPhaseDates =
    period.bidding_start ||
    period.pdc1_start ||
    period.pdc2_start ||
    period.expo_date ||
    period.ta_start;

  const hasGroupConfig =
    period.min_group_size !== null ||
    period.max_group_size !== null ||
    period.max_supervisor_load !== null;

  const hasReminders =
    period.bidding_reminder_at ||
    period.pdc1_reminder_at ||
    period.pdc2_reminder_at ||
    period.expo_reminder_at ||
    period.ta_reminder_at;

  if (!hasPhaseDates && !hasGroupConfig && !hasReminders) return null;

  return (
    <div className="grid grid-cols-1 gap-6 px-4 py-4 md:grid-cols-2 lg:grid-cols-3">
      {hasPhaseDates && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
            Tanggal Fase
          </h4>
          <div className="space-y-2 text-sm">
            {period.bidding_start && (
              <div className="flex justify-between">
                <span className="text-gray-600">Bidding</span>
                <span className="font-medium text-gray-900">
                  {formatDate(period.bidding_start)} —{" "}
                  {formatDate(period.bidding_end)}
                </span>
              </div>
            )}
            {period.pdc1_start && (
              <div className="flex justify-between">
                <span className="text-gray-600">PDC1</span>
                <span className="font-medium text-gray-900">
                  {formatDate(period.pdc1_start)} —{" "}
                  {formatDate(period.pdc1_end)}
                </span>
              </div>
            )}
            {period.pdc2_start && (
              <div className="flex justify-between">
                <span className="text-gray-600">PDC2</span>
                <span className="font-medium text-gray-900">
                  {formatDate(period.pdc2_start)} —{" "}
                  {formatDate(period.pdc2_end)}
                </span>
              </div>
            )}
            {period.expo_date && (
              <div className="flex justify-between">
                <span className="text-gray-600">EXPO</span>
                <span className="font-medium text-gray-900">
                  {formatDate(period.expo_date)}
                </span>
              </div>
            )}
            {period.ta_start && (
              <div className="flex justify-between">
                <span className="text-gray-600">Sidang TA</span>
                <span className="font-medium text-gray-900">
                  {formatDate(period.ta_start)} — {formatDate(period.ta_end)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {hasGroupConfig && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
            Konfigurasi Group
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Jumlah Anggota</span>
              <span className="font-medium text-gray-900">
                {period.min_group_size} — {period.max_group_size} orang
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Max Dosen Pembimbing</span>
              <span className="font-medium text-gray-900">
                {period.max_supervisor_load} group/dosen
              </span>
            </div>
          </div>
        </div>
      )}

      {hasReminders && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
            Tanggal Pengingat
          </h4>
          <div className="space-y-2 text-sm">
            {period.bidding_reminder_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Bidding</span>
                <span className="font-medium text-gray-900">
                  {formatDate(period.bidding_reminder_at)}
                </span>
              </div>
            )}
            {period.pdc1_reminder_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">PDC1</span>
                <span className="font-medium text-gray-900">
                  {formatDate(period.pdc1_reminder_at)}
                </span>
              </div>
            )}
            {period.pdc2_reminder_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">PDC2</span>
                <span className="font-medium text-gray-900">
                  {formatDate(period.pdc2_reminder_at)}
                </span>
              </div>
            )}
            {period.expo_reminder_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">EXPO</span>
                <span className="font-medium text-gray-900">
                  {formatDate(period.expo_reminder_at)}
                </span>
              </div>
            )}
            {period.ta_reminder_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Sidang TA</span>
                <span className="font-medium text-gray-900">
                  {formatDate(period.ta_reminder_at)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface PeriodColumnCallbacks {
  onEdit: (period: Period) => void;
  onDelete: (period: Period) => void;
  onToggleActive: (period: Period) => void;
  deleting: number | null;
}

export function periodColumns({
  onEdit,
  onDelete,
  onToggleActive,
  deleting,
}: PeriodColumnCallbacks): ColumnDef<Period>[] {
  return [
    {
      id: "expander",
      header: () => null,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            row.toggleExpanded();
          }}
        >
          {row.getIsExpanded() ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </Button>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8 cursor-pointer font-semibold text-gray-700"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          <MapPin className="mr-1 h-4 w-4" />
          Nama Periode
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-medium text-gray-900">
          {row.getValue("name")}
        </span>
      ),
      filterFn: "includesString",
    },
    {
      id: "duration",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8 cursor-pointer font-semibold text-gray-700"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Durasi
        </Button>
      ),
      accessorFn: (row) => `${row.start_date}|${row.end_date}`,
      cell: ({ row }) => {
        const period = row.original;
        return (
          <span className="text-gray-600">
            {formatDate(period.start_date)} — {formatDate(period.end_date)}
          </span>
        );
      },
      sortingFn: (rowA, rowB) => {
        const dateA = new Date(rowA.original.start_date).getTime();
        const dateB = new Date(rowB.original.start_date).getTime();
        return dateA - dateB;
      },
    },
    {
      id: "group_config",
      header: () => (
        <span className="font-semibold text-gray-700">Konfigurasi Group</span>
      ),
      cell: ({ row }) => {
        const period = row.original;
        if (
          period.min_group_size === null &&
          period.max_group_size === null &&
          period.max_supervisor_load === null
        ) {
          return (
            <span className="text-sm text-gray-400">Belum dikonfigurasi</span>
          );
        }
        return (
          <span className="text-sm text-gray-600">
            {period.min_group_size}-{period.max_group_size} anggota
            {period.max_supervisor_load && (
              <span className="text-gray-400">
                {" "}
                · {period.max_supervisor_load}/dosen
              </span>
            )}
          </span>
        );
      },
      enableSorting: false,
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
        </Button>
      ),
      cell: ({ row }) => {
        const isActive = row.getValue("is_active") as boolean;
        return isActive ? (
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
      id: "actions",
      header: () => <span className="font-semibold text-gray-700">Action</span>,
      cell: ({ row }) => {
        const period = row.original;
        const isDeleting = deleting === period.id;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                disabled={isDeleting}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4 text-gray-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(period)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleActive(period)}>
                <FileText className="mr-2 h-4 w-4" />
                {period.is_active ? "Nonaktifkan" : "Aktifkan"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(period)}
                className={cn(
                  "text-red-600 focus:text-red-600",
                  isDeleting && "pointer-events-none opacity-50"
                )}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeleting ? "Menghapus..." : "Hapus"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
    },
  ];
}
