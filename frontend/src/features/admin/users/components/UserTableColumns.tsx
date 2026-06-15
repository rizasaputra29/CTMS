"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableColumn } from "@/components/ui/data-table";
import { AvatarWithInitials } from "@/components/common/AvatarWithInitials";
import { getRoleBadgeVariant } from "@/lib/badge-variants";
import {
  Edit,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Trash2,
  UserX,
  Users,
  GraduationCap,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import type { User } from "../types";

function RoleIcon({ slug }: { slug: string }) {
  switch (slug) {
    case "admin":
      return <ShieldCheck className="h-3 w-3" />;
    case "dosen":
      return <Stethoscope className="h-3 w-3" />;
    case "mahasiswa":
      return <GraduationCap className="h-3 w-3" />;
    default:
      return <Users className="h-3 w-3" />;
  }
}

function roleSlugs(user: User): ("admin" | "dosen" | "mahasiswa")[] {
  return (
    user.roles?.map((r) => r.slug as "admin" | "dosen" | "mahasiswa") || [
      user.role as "admin" | "dosen" | "mahasiswa",
    ]
  );
}

function primaryRoleSlug(user: User) {
  return roleSlugs(user)[0];
}

interface UseUserColumnsProps {
  kickingUserId: number | null;
  onView: (user: User) => void;
  onEdit: (user: User) => void;
  onDelete: (id: number) => void;
  onKick: (user: User) => void;
}

export function useUserColumns({
  kickingUserId,
  onView,
  onEdit,
  onDelete,
  onKick,
}: UseUserColumnsProps): DataTableColumn<User>[] {
  return [
    { key: "no", header: "No", width: "w-12" },
    {
      key: "name",
      header: "Nama User",
      sortable: true,
      render: (user) => (
        <div className="flex items-center gap-3">
          <AvatarWithInitials
            name={user.name}
            size="default"
            className="h-8 w-8"
          />
          <span className="font-medium text-sm text-foreground">
            {user.name}
          </span>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      render: (user) => (
        <span className="text-sm text-muted-foreground">{user.email}</span>
      ),
    },
    {
      key: "roles",
      header: "Access Role",
      render: (user) => {
        const slugs = roleSlugs(user);
        return (
          <div className="flex flex-wrap gap-1">
            {slugs.map((slug) => (
              <Badge
                key={`${user.id}-${slug}`}
                variant={getRoleBadgeVariant(slug)}
                className="flex items-center gap-1 text-xs px-2 py-0.5 capitalize"
              >
                <RoleIcon slug={slug} />
                {slug}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: "created_at",
      header: "Tanggal Daftar",
      sortable: true,
      render: (user) => (
        <span className="text-muted-foreground whitespace-nowrap text-sm">
          {new Date(user.created_at).toLocaleDateString("en-US", {
            month: "numeric",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      ),
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      render: (user) => {
        const mainSlug = primaryRoleSlug(user);
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onView(user)}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Lihat Detail
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(user);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {mainSlug === "mahasiswa" &&
                  user.registered_periods &&
                  user.registered_periods.length > 0 && (
                    <DropdownMenuItem
                      onClick={() => onKick(user)}
                      disabled={kickingUserId === user.id}
                      className="text-orange-600 focus:text-orange-600 focus:bg-orange-50"
                    >
                      {kickingUserId === user.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <UserX className="mr-2 h-4 w-4" />
                      )}
                      Kick
                    </DropdownMenuItem>
                  )}
                {user.id !== 1 && (
                  <DropdownMenuItem
                    onClick={() => onDelete(user.id)}
                    variant="destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
