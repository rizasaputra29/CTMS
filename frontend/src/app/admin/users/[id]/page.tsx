"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, Pencil, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { MultiRoleSelect, type RoleOption } from "@/components/administration/user-detail/MultiRoleSelect"
import { getRoleBadgeVariant } from "@/lib/badge-variants"
import api from "@/lib/api"
import { toast } from "sonner"

const roleOptions: RoleOption[] = [
  { label: "Mahasiswa", value: "mahasiswa" },
  { label: "Dosen", value: "dosen" },
  { label: "Admin", value: "admin" },
]

interface Role {
  id: number
  name: string
  slug: string
}

interface UserDetail {
  id: number
  name: string
  email: string
  nim?: string
  role: string
  roles: Role[]
  is_active: boolean
  created_at: string
  updated_at: string
}

function generateInitials(name: string): string {
  if (!name || typeof name !== 'string') return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
}

function getRoleSlugs(user: UserDetail): string[] {
  if (user.roles && user.roles.length > 0) {
    return user.roles.map((r) => r.slug)
  }
  return [user.role]
}

function getPrimaryRoleSlug(user: UserDetail): string {
  const slugs = getRoleSlugs(user)
  return slugs[0] || "mahasiswa"
}

function getRoleLabel(slug: string): string {
  switch (slug) {
    case "admin": return "Admin"
    case "dosen": return "Dosen"
    case "mahasiswa": return "Mahasiswa"
    default: return slug
  }
}

export default function UserDetailPage() {
  const router = useRouter()
  const { id } = useParams()
  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])

  useEffect(() => {
    async function fetchUser() {
      try {
        setLoading(true)
        const response = await api.get(`/admin/users/${id}`)
        const data = response.data
        setUser(data)
        const slugs = data.roles && data.roles.length > 0
          ? data.roles.map((r: Role) => r.slug)
          : [data.role]
        setSelectedRoles(slugs)
      } catch {
        toast.error("Gagal memuat data user")
        router.push("/admin/users")
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchUser()
  }, [id, router])

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this user?")) return
    try {
      await api.delete(`/admin/users/${id}`)
      toast.success("User deleted")
      router.push("/admin/users")
    } catch {
      toast.error("Failed to delete user")
    }
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const primaryRole = getPrimaryRoleSlug(user)

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              className="border-grey-100 text-grey-600 hover:bg-grey-25 hover:text-grey-600"
              onClick={() => router.push("/admin/users")}
            >
              <ChevronLeft className="size-4" />
              Kembali
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/admin/users/${user.id}/edit`}>
              <Button
                variant="outline"
                size="sm"
                className="border-grey-100 text-grey-600 hover:bg-grey-25 hover:text-grey-600"
              >
                <Pencil className="size-4" />
                Edit
              </Button>
            </Link>
            {user.id !== 1 && (
              <Button
                variant="outline"
                size="sm"
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={handleDelete}
              >
                <Trash2 className="size-4" />
                Hapus
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <Avatar className="size-16 shrink-0 rounded-full bg-primary-100 ring-4 ring-grey-0">
            <AvatarFallback className="bg-primary-100 text-primary-500 text-xl font-semibold">
              {generateInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[32px] leading-tight font-semibold text-grey-600">
                {user.name}
              </h1>
              <Badge
                variant="outline"
                className="border-primary-200 bg-primary-50 text-primary-500 text-xs font-medium h-6 px-2"
              >
                SSO
              </Badge>
            </div>
            {user.nim && (
              <p className="text-sm font-medium text-grey-400">
                NIM: {user.nim}
              </p>
            )}
          </div>
        </div>

        {/* User Info Grid - Matching reference layout */}
        <div className="space-y-4">
          {/* Row 1: Email | Angkatan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-normal text-grey-400">Email</p>
              <p className="text-sm font-medium text-grey-600">{user.email}</p>
            </div>
            <div>
              <p className="text-sm font-normal text-grey-400">Angkatan</p>
              <p className="text-sm font-medium text-grey-600">
                {user.nim ? `20${user.nim.substring(0, 2)}` : '-'}
              </p>
            </div>
          </div>
          
          {/* Row 2: Access Role | Tanggal Daftar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-normal text-grey-400">Access Role</p>
              <Badge variant={getRoleBadgeVariant(primaryRole)} className="mt-0.5 text-xs font-medium px-2.5 py-0.5">
                {getRoleLabel(primaryRole)}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-normal text-grey-400">Tanggal Daftar</p>
              <p className="text-sm font-medium text-grey-600">{formatDate(user.created_at)}</p>
            </div>
          </div>
          
          {/* Row 3: Aktifitas Terakhir (placeholder) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div></div>
            <div>
              <p className="text-sm font-normal text-grey-400">Aktifitas Terakhir</p>
              <p className="text-sm font-medium text-grey-600">-</p>
            </div>
          </div>
        </div>

        <Card className="shadow-small rounded-xl border-grey-100">
          <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_1fr] p-6">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-grey-600">
                Role & Permissions
              </h2>
              <p className="text-sm font-normal text-grey-400">
                Manage roles and module permissions for each user
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-grey-600">
                Access Role
              </label>
              <MultiRoleSelect
                options={roleOptions}
                value={selectedRoles}
                onChange={setSelectedRoles}
                placeholder="Pilih role..."
              />
            </div>
          </CardContent>
        </Card>
    </div>
  )
}
