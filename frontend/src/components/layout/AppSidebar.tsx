'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BookOpen, Calendar as CalendarIcon, ChevronUp, Users, Settings, GraduationCap, LayoutDashboard, FileText, User, LogOut, PenLine, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';

export function AppSidebar() {
    const { user, logout } = useAuth();
    const pathname = usePathname();

    const navItems = {
        admin: [
            { title: 'Dashboard', url: '/admin/dashboard', icon: LayoutDashboard },
            { title: 'Users', url: '/admin/users', icon: Users },
            { title: 'Periods', url: '/admin/periods', icon: CalendarIcon },
            { title: 'Schedule', url: '/admin/schedule', icon: CalendarIcon },
            { title: 'Settings', url: '/admin/settings', icon: Settings },
        ],
        mahasiswa: [
            { title: 'Dashboard', url: '/mahasiswa/dashboard', icon: LayoutDashboard },
            { title: 'My Group', url: '/mahasiswa/group', icon: Users },
            { title: 'Propose Title', url: '/mahasiswa/propose-title', icon: PenLine },
            { title: 'Titles & Group', url: '/mahasiswa/titles', icon: BookOpen },
            { title: 'Documents', url: '/mahasiswa/documents', icon: FileText },
            { title: 'Schedule', url: '/mahasiswa/schedule', icon: CalendarIcon },
            { title: 'Grades', url: '/mahasiswa/grades', icon: GraduationCap },
        ],
        dosen: [
            { title: 'Dashboard', url: '/dosen/dashboard', icon: LayoutDashboard },
            { title: 'Titles', url: '/dosen/titles', icon: BookOpen },
            { title: 'Title Approvals', url: '/dosen/title-approvals', icon: ClipboardCheck },
            { title: 'Requests', url: '/dosen/requests', icon: Users },
            { title: 'Bimbingan', url: '/dosen/bimbingan', icon: FileText },
            { title: 'Schedule', url: '/dosen/schedule', icon: CalendarIcon },
            { title: 'Evaluation', url: '/dosen/evaluation', icon: GraduationCap },
        ],
    };

    const role = (user?.role as keyof typeof navItems) || 'mahasiswa';
    const items = navItems[role] || [];

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <div className="flex items-center gap-2 px-2 py-2">
                    <Image 
                        src="/logo.png"
                        alt="Logo"
                        width={32}
                        height={32}
                    />
                <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">CTMS</span>
                    <span className="truncate text-xs">Academic System</span>
                </div>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Menu</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                                        <Link href={item.url}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>

                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton
                                    size="lg"
                                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                                >
                                    <Avatar className="h-8 w-8 rounded-lg">
                                        <AvatarImage src="" alt={user?.name} />
                                        <AvatarFallback className="rounded-lg">{user?.name ? user.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) : '?'}</AvatarFallback>
                                    </Avatar>
                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-semibold">{user?.name}</span>
                                        <span className="truncate text-xs">{user?.email}</span>
                                    </div>
                                    <ChevronUp className="ml-auto size-4" />
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                                side="bottom"
                                align="end"
                                sideOffset={4}
                            >
                                <DropdownMenuLabel className="p-0 font-normal">
                                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                        <Avatar className="h-8 w-8 rounded-lg">
                                            <AvatarImage src="" alt={user?.name} />
                                            <AvatarFallback className="rounded-lg">{user?.name ? user.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) : '?'}</AvatarFallback>
                                        </Avatar>
                                        <div className="grid flex-1 text-left text-sm leading-tight">
                                            <span className="truncate font-semibold">{user?.name}</span>
                                            <span className="truncate text-xs">{user?.email}</span>
                                        </div>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link href="/profile">
                                         <User className="mr-2 h-4 w-4" />
                                         Account
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={logout}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Log out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
