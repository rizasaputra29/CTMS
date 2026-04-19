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
     ListChecks, BarChart3, GitCompare, Star, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import api from '@/lib/api';

export function AppSidebar() {
    const { user, activeRole, logout, switchRole } = useAuth();
    const pathname = usePathname();
    const [unreadCount, setUnreadCount] = useState(0);
    const [peerReviewActive, setPeerReviewActive] = useState(false);
    const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
    const [groupStatus, setGroupStatus] = useState<string | null>(null);
    const [supervisorEvalCount, setSupervisorEvalCount] = useState(0);
    const [examinerEvalCount, setExaminerEvalCount] = useState(0);

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
            if (activeRole === 'mahasiswa') {
                try {
                    const res = await api.get('/mahasiswa/peer-review/status');
                    setPeerReviewActive(res.data.active || false);
                } catch {
                    // Silently fail
                }
            }
        };

        const fetchSupervisorEvalCount = async () => {
            if (activeRole === 'dosen') {
                try {
                    const res = await api.get('/dosen/supervisor-evaluation/pending-count');
                    setSupervisorEvalCount(res.data?.count || 0);
                } catch {
                    // Silently fail
                }
            }
        };

        const fetchExaminerEvalCount = async () => {
            if (activeRole === 'dosen') {
                try {
                    interface Evaluation {
                        status: string;
                    }
                    interface ScheduleItem {
                        evaluations?: Evaluation[];
                    }
                    const res = await api.get('/dosen/seminar-schedules/examiner');
                    const seminars: ScheduleItem[] = res.data?.data?.seminars || [];
                    const defenses: ScheduleItem[] = res.data?.data?.ta_defenses || [];

                    // Count pending evaluations
                    const pendingSeminars = seminars.filter((s) =>
                        s.evaluations?.some((e) => e.status === 'PENDING')
                    ).length;
                    const pendingDefenses = defenses.filter((d) =>
                        d.evaluations?.some((e) => e.status === 'PENDING')
                    ).length;

                    setExaminerEvalCount(pendingSeminars + pendingDefenses);
                } catch {
                    // Silently fail
                }
            }
        };

        fetchUnread();
        fetchPeerReviewStatus();
        fetchSupervisorEvalCount();
        fetchExaminerEvalCount();
        
        // Check TA status for mahasiswa
        const fetchTAStatus = async () => {
            if (activeRole === 'mahasiswa') {
                try {
                    await api.get('/mahasiswa/ta-status');
                    // TA status data is available
                } catch {
                    // Silently fail
                }
            }
        };
        fetchTAStatus();

        // Check period registration for mahasiswa
        const checkRegistration = async () => {
            if (activeRole === 'mahasiswa') {
                try {
                    const res = await api.get('/mahasiswa/my-period');
                    setIsRegistered(!!res.data?.period);
                } catch {
                    setIsRegistered(false);
                }
            }
        };
        checkRegistration();

        // Listen for registration complete event
        const handleRegistrationComplete = () => {
            checkRegistration();
        };
        window.addEventListener('registration-complete', handleRegistrationComplete);

        return () => {
            window.removeEventListener('registration-complete', handleRegistrationComplete);
        };
    }, [user, activeRole]);

    // Fetch group status for menu availability check
    useEffect(() => {
        if (activeRole === 'mahasiswa' && isRegistered) {
            api.get('/mahasiswa/group')
                .then(res => setGroupStatus(res.data.group?.status || null))
                .catch(() => setGroupStatus(null));
        }
    }, [activeRole, isRegistered]);

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
                    { title: 'Document Requirements', url: '/admin/document-requirements', icon: FileText },
                ]
            },
            {
                title: 'Evaluation Setup',
                icon: ListChecks,
                items: [
                    { title: 'Assessment Bank', url: '/admin/assessment-bank', icon: BookOpen },
                    { title: 'Active Components', url: '/admin/assessments', icon: ListChecks },
                    { title: 'Period Config', url: '/admin/period-assessment-config', icon: Settings },
                    { title: 'Peer Review', url: '/admin/peer-review', icon: Star },
                ]
            },
            {
                title: 'Management',
                icon: Settings,
                items: [
                    { title: 'Finalization', url: '/admin/finalization', icon: ShieldCheck },
                    { title: 'Groups', url: '/admin/groups', icon: Users },
                    { title: 'Schedule', url: '/admin/schedule', icon: CalendarIcon },
                    { title: 'Expo Events', url: '/admin/expo', icon: Presentation },
                    { title: 'TA Defense', url: '/admin/ta-defense', icon: GraduationCap },
                ]
            },
            {
                title: 'Analytics',
                icon: BarChart3,
                items: [
                    { title: 'Evaluation Summary', url: '/admin/analytics/evaluation-summary', icon: FileText },
                    { title: 'Grade Check', url: '/admin/grade-consistency', icon: GitCompare },
                    { title: 'Grade Config', url: '/admin/grade-configuration', icon: GraduationCap },
                    { title: 'Peer Review Dashboard', url: '/admin/peer-review-dashboard', icon: Users },
                    { title: 'Reports', url: '/admin/reports', icon: BarChart3 },
                ]
            },
        ],
        mahasiswa: [
            { title: 'Dashboard', url: '/mahasiswa/dashboard', icon: LayoutDashboard },
            { title: 'Registration', url: '/mahasiswa/registration', icon: CalendarIcon },
            {
                title: 'Group & Titles',
                icon: Users,
                items: [
                    { title: 'My Group', url: '/mahasiswa/group', icon: Users },
                    { title: 'Titles Marketplace', url: '/mahasiswa/titles', icon: BookOpen },
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
                    { title: 'TA Defense', url: '/mahasiswa/ta-defense', icon: GraduationCap },
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
                    { title: 'Supervisor Evaluation', url: '/dosen/supervisor-evaluation', icon: Star },
                ]
            },
        ],
    };

    // Collect all nav items from all roles (don't filter by activeRole)
    const userRoles = user?.roles || [user?.role || 'mahasiswa'];
    
    // Helper function to check if menu should be disabled based on group status
    // Menus that require PDC1_ACTIVE or higher: 'Progress & Docs', 'Schedules', 'Evaluations'
    const isMenuDisabledByStatus = (menuTitle: string): boolean => {
        const pdc1RequiredMenus = ['Progress & Docs', 'Schedules', 'Evaluations'];
        
        // If not a PDC1-required menu, always enabled
        if (!pdc1RequiredMenus.includes(menuTitle)) return false;
        
        // If no group status (not in a group yet), disable PDC1 menus
        if (!groupStatus) return true;
        
        // Statuses that allow PDC1 menus (PDC1_ACTIVE and onwards)
        const allowedStatuses = [
            'PDC1_ACTIVE',
            'READY_FOR_SEMPRO',
            'SEMPRO_DONE',
            'PDC2_ACTIVE',
            'PDC2_READY_FOR_EXPO',
            'EXPO_REGISTERED',
            'EXPO_DONE',
            'PDC2_COMPLETED',
            'CLOSED'
        ];
        
        return !allowedStatuses.includes(groupStatus);
    };

    // Deduplicate items by title to avoid repeated blocks if roles overlap
    const seenTitles = new Set();
    const items: NavItem[] = [];

    userRoles.forEach(r => {
        const roleItems = navItems[r as keyof typeof navItems] || [];
        roleItems.forEach(item => {
            if (!seenTitles.has(item.title)) {
                seenTitles.add(item.title);
                
                // Special handling for Peer Review inside Mahasiswa role
                if (r === 'mahasiswa' && !peerReviewActive) {
                    if (item.title === 'Evaluations' && item.items) {
                        items.push({
                            ...item,
                            items: item.items.filter(i => i.title !== 'Peer Review')
                        });
                        return;
                    }
                }
                items.push(item);
            }
        });
    });

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

                                // Check if this item should be disabled for unregistered mahasiswa
                                const isMahasiswa = activeRole === 'mahasiswa';
                                const isRegistrationItem = item.title === 'Registration' || item.url === '/mahasiswa/registration';
                                const isDashboardItem = item.title === 'Dashboard' || item.url === '/mahasiswa/dashboard';
                                const isUnregistered = isMahasiswa && isRegistered === false && !isRegistrationItem && !isDashboardItem;
                                const isDisabledByStatus = isMahasiswa && isMenuDisabledByStatus(item.title);
                                const isDisabled = isUnregistered || isDisabledByStatus;

                                // Determine tooltip message based on disabled reason
                                const getTooltipMessage = () => {
                                    if (isUnregistered) return 'Register for a period first';
                                    if (isDisabledByStatus) return 'Available after PDC1 starts';
                                    return item.title;
                                };

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
                                                    <SidebarMenuButton 
                                                        tooltip={getTooltipMessage()} 
                                                        isActive={hasActiveSubitem}
                                                        className={isDisabled ? 'opacity-50' : ''}
                                                    >
                                                        {item.icon && <item.icon />}
                                                        <span>{item.title}</span>
                                                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                                    </SidebarMenuButton>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent>
                                                    <SidebarMenuSub>
                                                        {item.items.map((subItem) => (
                                                            <SidebarMenuSubItem key={subItem.title}>
                                                                <SidebarMenuSubButton 
                                                                    asChild 
                                                                    isActive={pathname === subItem.url}
                                                                    className={isDisabled ? 'pointer-events-none opacity-50' : ''}
                                                                >
                                                                    <Link href={subItem.url} className="flex items-center justify-between w-full">
                                                                        <div className="flex items-center">
                                                                            {subItem.icon && <subItem.icon className="mr-2 h-4 w-4" />}
                                                                            <span>{subItem.title}</span>
                                                                        </div>
                                                                        {subItem.title === 'Supervisor Evaluation' && supervisorEvalCount > 0 && (
                                                                            <span className="ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-primary-foreground text-xs font-bold">
                                                                                {supervisorEvalCount > 99 ? '99+' : supervisorEvalCount}
                                                                            </span>
                                                                        )}
                                                                        {subItem.title === 'Evaluate Students' && (examinerEvalCount + supervisorEvalCount) > 0 && (
                                                                            <span className="ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-primary-foreground text-xs font-bold">
                                                                                {(examinerEvalCount + supervisorEvalCount) > 99 ? '99+' : (examinerEvalCount + supervisorEvalCount)}
                                                                            </span>
                                                                        )}
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
                                        <SidebarMenuButton 
                                            asChild 
                                            isActive={isItemActive} 
                                            tooltip={getTooltipMessage()}
                                            className={isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                                        >
                                            <Link href={item.url!} className={isDisabled ? 'pointer-events-none' : ''}>
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
                                {/* Role Switcher - Show if user has multiple roles */}
                                {user?.roles && user.roles.length > 1 && (
                                    <>
                                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                                            Switch Role
                                        </DropdownMenuLabel>
                                        {user.roles.map((role) => (
                                            <DropdownMenuItem
                                                key={role}
                                                onClick={() => switchRole(role)}
                                                className="cursor-pointer"
                                            >
                                                <span className="capitalize mr-2">{role}</span>
                                                {role === activeRole && (
                                                    <span className="text-xs text-primary">✓</span>
                                                )}
                                            </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuSeparator />
                                    </>
                                )}
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
