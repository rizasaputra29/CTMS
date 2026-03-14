'use client';

import React, { useEffect, useState } from 'react';
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
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarRail,
} from '@/components/ui/sidebar';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    BookOpen, Calendar as CalendarIcon, ChevronUp, Users, Settings,
    GraduationCap, LayoutDashboard, FileText, User, LogOut, PenLine,
    ClipboardCheck, Gavel, ShieldCheck, FileCheck, Bell, Presentation,
    ListChecks, FileType, BarChart3, GitCompare, Star, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import api from '@/lib/api';

export function AppSidebar() {
    const { user, logout } = useAuth();
    const pathname = usePathname();
    const [unreadCount, setUnreadCount] = useState(0);
    const [peerReviewActive, setPeerReviewActive] = useState(false);

    // Fetch unread notification count
    useEffect(() => {
        if (!user) return;
        const fetchUnread = async () => {
            try {
                const res = await api.get('/notifications/unread-count');
                setUnreadCount(res.data.count || 0);
            } catch {
                // Silently fail
            }
        };
        const fetchPeerReviewStatus = async () => {
            if (user?.role === 'mahasiswa') {
                try {
                    const res = await api.get('/mahasiswa/peer-review/status');
                    setPeerReviewActive(res.data.active || false);
                } catch {
                    // Silently fail
                }
            }
        };

        fetchUnread();
        fetchPeerReviewStatus();
        // Removed the setInterval to prevent excessive polling and lag
    }, [user]);

    type NavItem = {
        title: string;
        url?: string;
        icon: React.ElementType;
        items?: { title: string; url: string; icon?: React.ElementType }[];
    };

    const navItems: Record<string, NavItem[]> = {
        admin: [
            { title: 'Dashboard', url: '/admin/dashboard', icon: LayoutDashboard },
            { 
                title: 'Master Data', 
                icon: Settings,
                items: [
                    { title: 'Periods', url: '/admin/periods', icon: CalendarIcon },
                    { title: 'Users', url: '/admin/users', icon: Users },
                    { title: 'Document Types', url: '/admin/document-types', icon: FileType },
                ]
            },
            {
                title: 'Evaluation Setup',
                icon: ListChecks,
                items: [
                    { title: 'Assessments', url: '/admin/assessments', icon: ListChecks },
                    { title: 'Peer Review', url: '/admin/peer-review', icon: Star },
                ]
            },
            {
                title: 'Operations',
                icon: ShieldCheck,
                items: [
                    { title: 'Finalization', url: '/admin/finalization', icon: ShieldCheck },
                    { title: 'Schedule', url: '/admin/schedule', icon: CalendarIcon },
                    { title: 'Expo Events', url: '/admin/expo', icon: Presentation },
                ]
            },
            {
                title: 'Analytics',
                icon: BarChart3,
                items: [
                    { title: 'Grade Check', url: '/admin/grade-consistency', icon: GitCompare },
                    { title: 'Reports', url: '/admin/reports', icon: BarChart3 },
                ]
            },
        ],
        mahasiswa: [
            { title: 'Dashboard', url: '/mahasiswa/dashboard', icon: LayoutDashboard },
            {
                title: 'Group & Titles',
                icon: Users,
                items: [
                    { title: 'My Group', url: '/mahasiswa/group', icon: Users },
                    { title: 'Available Titles', url: '/mahasiswa/titles', icon: BookOpen },
                    { title: 'Propose Title', url: '/mahasiswa/propose-title', icon: PenLine },
                    { title: 'Title Bids', url: '/mahasiswa/bidding', icon: Gavel },
                ]
            },
            {
                title: 'Progress & Docs',
                icon: FileText,
                items: [
                    { title: 'Documents', url: '/mahasiswa/documents', icon: FileText },
                    { title: 'TA Submission', url: '/mahasiswa/ta', icon: FileCheck },
                ]
            },
            {
                title: 'Schedules',
                icon: CalendarIcon,
                items: [
                    { title: 'Seminar & Defense', url: '/mahasiswa/schedules', icon: ClipboardCheck },
                    { title: 'Expo', url: '/mahasiswa/expo', icon: Presentation },
                ]
            },
            {
                title: 'Evaluations',
                icon: GraduationCap,
                items: [
                    { title: 'Peer Review', url: '/mahasiswa/peer-review', icon: Star },
                    { title: 'My Grades', url: '/mahasiswa/grades', icon: GraduationCap },
                ]
            }
        ],
        dosen: [
            { title: 'Dashboard', url: '/dosen/dashboard', icon: LayoutDashboard },
            {
                title: 'Titles & Bids',
                icon: BookOpen,
                items: [
                    { title: 'My Titles', url: '/dosen/titles', icon: BookOpen },
                    { title: 'Title Approvals', url: '/dosen/title-approvals', icon: ClipboardCheck },
                    { title: 'Bid Review', url: '/dosen/bids', icon: Gavel },
                ]
            },
            {
                title: 'Mentoring',
                icon: Users,
                items: [
                    { title: 'Supervised Groups', url: '/dosen/supervised-groups', icon: Users },
                    { title: 'Bimbingan', url: '/dosen/bimbingan', icon: FileText },
                ]
            },
            {
                title: 'Schedule & Review',
                icon: FileCheck,
                items: [
                    { title: 'Bimbingan Schedule', url: '/dosen/schedule', icon: CalendarIcon },
                    { title: 'TA Review', url: '/dosen/ta-review', icon: FileCheck },
                    { title: 'Evaluate Students', url: '/dosen/evaluation', icon: GraduationCap },
                ]
            },
        ],
    };

    const role = (user?.role as keyof typeof navItems) || 'mahasiswa';
    let items = navItems[role] || [];

    if (role === 'mahasiswa' && !peerReviewActive) {
        items = items.map(group => {
            if (group.title === 'Evaluations' && group.items) {
                return {
                    ...group,
                    items: group.items.filter(item => item.title !== 'Peer Review'),
                };
            }
            return group;
        });
    }

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
                            {items.map((item) => {
                                const isItemActive = pathname === item.url;
                                const hasActiveSubitem = item.items?.some(sub => pathname === sub.url);
                                const isDefaultOpen = isItemActive || hasActiveSubitem;

                                if (item.items && item.items.length > 0) {
                                    return (
                                        <Collapsible
                                            key={item.title}
                                            asChild
                                            defaultOpen={isDefaultOpen}
                                            className="group/collapsible"
                                        >
                                            <SidebarMenuItem>
                                                <CollapsibleTrigger asChild>
                                                    <SidebarMenuButton tooltip={item.title} isActive={hasActiveSubitem}>
                                                        {item.icon && <item.icon />}
                                                        <span>{item.title}</span>
                                                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                                    </SidebarMenuButton>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent>
                                                    <SidebarMenuSub>
                                                        {item.items.map((subItem) => (
                                                            <SidebarMenuSubItem key={subItem.title}>
                                                                <SidebarMenuSubButton asChild isActive={pathname === subItem.url}>
                                                                    <Link href={subItem.url}>
                                                                        {subItem.icon && <subItem.icon className="mr-2 h-4 w-4" />}
                                                                        <span>{subItem.title}</span>
                                                                    </Link>
                                                                </SidebarMenuSubButton>
                                                            </SidebarMenuSubItem>
                                                        ))}
                                                    </SidebarMenuSub>
                                                </CollapsibleContent>
                                            </SidebarMenuItem>
                                        </Collapsible>
                                    );
                                }

                                return (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton asChild isActive={isItemActive} tooltip={item.title}>
                                            <Link href={item.url!}>
                                                {item.icon && <item.icon />}
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Notifications — shared across all roles */}
                <SidebarGroup>
                    <SidebarGroupLabel>System</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname === '/notifications'} tooltip="Notifications">
                                    <Link href="/notifications" className="relative">
                                        <Bell />
                                        <span>Notifications</span>
                                        {unreadCount > 0 && (
                                            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </span>
                                        )}
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
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
