"use client"

import { usePathname, useRouter } from "next/navigation"
import { Bell, User, Settings, LogOut, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/context/AuthContext"

export function TopBar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, activeRole, logout } = useAuth()

  // Generate user initials for avatar
  const generateInitials = (name: string): string => {
    if (!name || typeof name !== 'string') return '?'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  }

  const handleLogout = () => {
    logout()
  }

  // Generate breadcrumb from pathname
  const generateBreadcrumb = () => {
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length === 0) return [{ label: 'SICATA' }]
    
    const breadcrumb = [{ label: 'SICATA' }]
    
    // Get the last meaningful segment (not ID numbers)
    const lastSegment = segments[segments.length - 1]
    if (!/^\d+$/.test(lastSegment)) {
      const formatted = lastSegment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      breadcrumb.push({ label: formatted })
    } else if (segments.length > 1) {
      // If last is ID, use the one before
      const prevSegment = segments[segments.length - 2]
      const formatted = prevSegment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      breadcrumb.push({ label: formatted })
    }
    
    return breadcrumb
  }

  const breadcrumbItems = generateBreadcrumb()

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-6 py-4 border-b border-grey-100">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb">
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {breadcrumbItems.map((item, index) => (
            <li key={index} className="inline-flex items-center gap-2">
              {index > 0 && (
                <span className="text-grey-300">/</span>
              )}
              <span className={index === breadcrumbItems.length - 1 ? 'text-grey-600 font-medium' : 'text-grey-400'}>
                {item.label}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Button
          size="icon"
          className="h-9 w-9 text-grey-600 hover:text-grey-600 hover:bg-grey-25 rounded-full relative bg-white border"
        >
          <Search className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          className="h-9 w-9 text-grey-600 hover:text-grey-600 hover:bg-grey-25 rounded-full relative bg-white border"
        >
          <Bell className="h-5 w-5" />
          {/* Notification badge - red dot */}
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-error-100" />
        </Button>

        {/* User Profile Dropdown */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-3 h-10 px-2 hover:bg-grey-25"
              >
                <Avatar className="h-8 w-8 bg-grey-100">
                  <AvatarFallback className="bg-grey-100 text-grey-500 text-sm font-semibold">
                    {generateInitials(user.name || 'User')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left hidden sm:flex">
                  <span className="text-sm font-semibold text-grey-600 leading-tight">
                    {user.name || 'User'}
                  </span>
                  <span className="text-xs text-grey-400 leading-tight">
                    {activeRole ? activeRole.charAt(0).toUpperCase() + activeRole.slice(1) : 'User'}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold text-grey-600">{user.name || 'User'}</p>
                  <p className="text-xs text-grey-400">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/profile')}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-error-100">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
