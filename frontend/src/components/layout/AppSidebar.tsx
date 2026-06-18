"use client";

import React, { useEffect, useState, useCallback } from "react";
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
  useSidebar,
} from "@/components/ui/sidebar";
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
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BookOpen,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronUp,
  Users,
  Settings,
  GraduationCap,
  LayoutDashboard,
  FileText,
  User,
  LogOut,
  PenLine,
  ClipboardCheck,
  Gavel,
  ShieldCheck,
  FileCheck,
  Bell,
  Presentation,
  ListChecks,
  BarChart3,
  Star,
  ChevronRight,
  TrendingUp,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import api from "@/lib/api";
import { toNavRoleKey } from "@/types/guards";

const SIDEBAR_STATE_KEY = "sidebar_sections";

function loadSidebarState() {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(SIDEBAR_STATE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function saveSidebarState(state: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(state));
}

// ─── Navigation Items ──────────────────────────────────────
type NavItem = {
  title: string;
  url?: string;
  icon: React.ElementType;
  items?: { title: string; url: string; icon?: React.ElementType }[];
};

const navItems: Record<string, NavItem[]> = {
  admin: [
    {
      title: "Master Data",
      icon: Settings,
      items: [
        { title: "Periods", url: "/admin/periods", icon: CalendarIcon },
        { title: "Users", url: "/admin/users", icon: Users },
        { title: "Groups", url: "/admin/groups", icon: Users },
        { title: "Locations", url: "/admin/locations", icon: MapPin },
        {
          title: "Document Requirements",
          url: "/admin/document-requirements",
          icon: FileText,
        },
      ],
    },
    {
      title: "Evaluation Setup",
      icon: ListChecks,
      items: [
        {
          title: "Assessment Bank",
          url: "/admin/assessment-bank",
          icon: BookOpen,
        },
        {
          title: "Tipe Penilaian",
          url: "/admin/period-assessment-config",
          icon: ListChecks,
        },
        { title: "Peer Review", url: "/admin/peer-review", icon: Star },
        {
          title: "Grade Config",
          url: "/admin/evaluation-setup/grade-configuration",
          icon: GraduationCap,
        },
      ],
    },
    {
      title: "Management",
      icon: Settings,
      items: [
        {
          title: "Finalization",
          url: "/admin/finalization",
          icon: ShieldCheck,
        },
        { title: "Schedule", url: "/admin/schedule", icon: CalendarIcon },
        {
          title: "Sidang Proposal",
          url: "/admin/sempro",
          icon: ClipboardCheck,
        },
        { title: "Expo Events", url: "/admin/expo", icon: Presentation },
        { title: "TA Defense", url: "/admin/ta-defense", icon: GraduationCap },
      ],
    },
    {
      title: "Analytics",
      icon: BarChart3,
      items: [
        {
          title: "Progress",
          url: "/admin/analytics/progress",
          icon: TrendingUp,
        },
        {
          title: "Peer Review Dashboard",
          url: "/admin/peer-review-dashboard",
          icon: Users,
        },
        { title: "Reports", url: "/admin/reports", icon: BarChart3 },
      ],
    },
  ],
  mahasiswa: [
    {
      title: "Registration",
      url: "/mahasiswa/registration",
      icon: CalendarIcon,
    },
    {
      title: "Group & Titles",
      icon: Users,
      items: [
        { title: "My Group", url: "/mahasiswa/group", icon: Users },
        {
          title: "Titles Marketplace",
          url: "/mahasiswa/titles",
          icon: BookOpen,
        },
        {
          title: "Propose Title",
          url: "/mahasiswa/propose-title",
          icon: PenLine,
        },
        { title: "Title Bids", url: "/mahasiswa/bidding", icon: Gavel },
      ],
    },
    {
      title: "Progress & Docs",
      icon: FileText,
      items: [
        { title: "Documents", url: "/mahasiswa/documents", icon: FileText },
        {
          title: "TA Submission",
          url: "/mahasiswa/ta-submission",
          icon: FileCheck,
        },
      ],
    },
    {
      title: "Schedules",
      icon: CalendarIcon,
      items: [
        {
          title: "My Schedule",
          url: "/mahasiswa/schedule",
          icon: ClipboardCheck,
        },
        { title: "Daftar Expo", url: "/mahasiswa/expo", icon: Presentation },
      ],
    },
    {
      title: "Evaluations",
      icon: GraduationCap,
      items: [
        { title: "Peer Review", url: "/mahasiswa/peer-review", icon: Star },
        { title: "My Grades", url: "/mahasiswa/grades", icon: GraduationCap },
      ],
    },
  ],
  dosen: [
    {
      title: "Titles & Bids",
      icon: BookOpen,
      items: [
        { title: "My Titles", url: "/dosen/titles", icon: BookOpen },
        {
          title: "Title Approvals",
          url: "/dosen/title-approvals",
          icon: ClipboardCheck,
        },
        { title: "Bid Review", url: "/dosen/bids", icon: Gavel },
      ],
    },
    {
      title: "Mentoring",
      icon: Users,
      items: [
        {
          title: "Supervised Groups",
          url: "/dosen/supervised-groups",
          icon: Users,
        },
        { title: "Bimbingan", url: "/dosen/bimbingan", icon: FileText },
      ],
    },
    {
      title: "Schedule & Review",
      icon: FileCheck,
      items: [
        { title: "My Schedule", url: "/dosen/schedule", icon: CalendarIcon },
        {
          title: "Evaluate Students",
          url: "/dosen/evaluation",
          icon: GraduationCap,
        },
        {
          title: "Supervisor Evaluation",
          url: "/dosen/supervisor-evaluation",
          icon: Star,
        },
      ],
    },
  ],
};

// ─── Category IDs for multi-role sidebar ──────────────────────
const categoryIds: Record<string, string> = {
  "Master Data": "admin-master",
  "Evaluation Setup": "admin-evaluation",
  Management: "admin-management",
  Analytics: "admin-analytics",
  "Titles & Bids": "dosen-titles",
  Mentoring: "dosen-mentoring",
  "Schedule & Review": "dosen-schedule",
};

// ─── Sidebar Section Component ──────────────────────────────
function SidebarSection({
  sectionId,
  label,
  icon: Icon,
  defaultOpen,
  isOpen,
  onOpenChange,
  children,
}: {
  sectionId: string;
  label: string;
  icon: React.ElementType;
  defaultOpen: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = loadSidebarState();
      if (saved && saved[sectionId] !== undefined) {
        setInternalOpen(saved[sectionId]);
      }
    }
  }, [sectionId]);

  const isControlled = isOpen !== undefined;
  const open = isControlled ? isOpen : internalOpen;

  const toggle = useCallback(() => {
    const next = !open;
    if (!isControlled) {
      setInternalOpen(next);
    }
    saveSidebarState({ ...(loadSidebarState() || {}), [sectionId]: next });
    onOpenChange?.(next);
  }, [open, isControlled, sectionId, onOpenChange]);

  return (
    <Collapsible
      open={open}
      onOpenChange={toggle}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={label}>
            <Icon />
            <span className="font-semibold">{label}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>{children}</SidebarMenuSub>
          {/* Small spacer between sub-sections */}
          <div className="mb-2" />
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

// ─── Category Collapsible Component (main menu item with children) ─────────────────
function SidebarCategoryCollapsible({
  sectionId,
  label,
  icon: Icon,
  isOpen,
  onOpenChange,
  isActive = false,
  children,
}: {
  sectionId: string;
  label: string;
  icon: React.ElementType;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  isActive?: boolean;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = loadSidebarState();
      if (saved && saved[sectionId] !== undefined) {
        setInternalOpen(saved[sectionId]);
      }
    }
  }, [sectionId]);

  const isControlled = isOpen !== undefined;
  const open = isControlled ? isOpen : internalOpen;

  const toggle = useCallback(() => {
    const next = !open;
    if (!isControlled) {
      setInternalOpen(next);
    }
    saveSidebarState({ ...(loadSidebarState() || {}), [sectionId]: next });
    onOpenChange?.(next);
  }, [open, isControlled, sectionId, onOpenChange]);

  return (
    <Collapsible
      open={open}
      onOpenChange={toggle}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={label} isActive={isActive}>
            <Icon />
            <span>{label}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>{children}</SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

// ─── Sub-section Component ──────────────────────────────────
function SidebarSubSection({
  sectionId,
  label,
  icon: Icon,
  isOpen,
  onOpenChange,
  children,
}: {
  sectionId: string;
  label: string;
  icon: React.ElementType;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(() => {
    const saved = loadSidebarState();
    return saved ? (saved[sectionId] ?? false) : false;
  });

  const isControlled = isOpen !== undefined;
  const open = isControlled ? isOpen : internalOpen;

  const toggle = useCallback(() => {
    const next = !open;
    if (!isControlled) {
      setInternalOpen(next);
    }
    saveSidebarState({ ...(loadSidebarState() || {}), [sectionId]: next });
    onOpenChange?.(next);
  }, [open, isControlled, sectionId, onOpenChange]);

  return (
    <Collapsible
      open={open}
      onOpenChange={toggle}
      className="group/subsection py-0.5"
    >
      <SidebarMenuSubItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton>
            <Icon className="h-3.5 w-3.5" />
            <span className="text-xs">{label}</span>
            <ChevronRight className="ml-auto h-3 w-3 transition-transform duration-200 group-data-[state=open]/subsection:rotate-90" />
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>{children}</SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}

// ─── Main Component ─────────────────────────────────────────

export function AppSidebar() {
  const { user, activeRole, logout, switchRole } = useAuth();
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [groupStatus, setGroupStatus] = useState<string | null>(null);
  const [supervisorEvalCount, setSupervisorEvalCount] = useState(0);
  const [examinerEvalCount, setExaminerEvalCount] = useState(0);

  const isMultiRole =
    user?.roles?.includes("admin") && user?.roles?.includes("dosen");

  // Compute single-role navigation items (needed for openItem initializer and renderSingleRoleSidebar)
  const currentRole = activeRole || user?.role || "mahasiswa";
  const safeRoleKey = toNavRoleKey(currentRole);
  const roleNavItems: NavItem[] = (navItems[safeRoleKey] || []).map((item) => {
    if (
      currentRole === "mahasiswa" &&
      item.title === "Evaluations" &&
      item.items
    ) {
      const allowedStatusesForPeerReview = [
        "EXPO_REGISTERED",
        "EXPO_DONE",
        "READY_FOR_TA_INDIVIDUAL",
        "TA_IN_PROGRESS",
        "CLOSED",
      ];
      if (!allowedStatusesForPeerReview.includes(groupStatus || "")) {
        return {
          ...item,
          items: item.items.filter((i) => i.title !== "Peer Review"),
        };
      }
    }
    return item;
  });

  // Lifted state from renderMultiRoleSidebar (fixes Rules of Hooks violation)
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  // Lifted state from renderSingleRoleSidebar (fixes Rules of Hooks violation)
  const [openItem, setOpenItem] = useState<string | null>(null);

  // Calculate active category/item based on pathname after hydration
  useEffect(() => {
    const allCategories = [...navItems.admin, ...navItems.dosen];
    const activeCategory = allCategories.find((item) =>
      item.items?.some((sub) => pathname === sub.url)
    );
    if (activeCategory) {
      setOpenCategory(
        categoryIds[activeCategory.title] ||
        activeCategory.title.toLowerCase().replace(/\s+/g, "-")
      );
    }

    const activeItem = roleNavItems.find((item) =>
      item.items?.some((sub) => pathname === sub.url)
    );
    setOpenItem(activeItem?.title || null);
  }, [pathname]);

  // Fetch unread notification count
  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const res = await api.get("/notifications/unread-count");
        setUnreadCount(res.data.count || 0);
      } catch {
        // Silently fail
      }
    };

    const fetchSupervisorEvalCount = async () => {
      const effectiveRole = isMultiRole ? "dosen" : activeRole;
      if (effectiveRole === "dosen") {
        try {
          const res = await api.get(
            `/dosen/supervisor-evaluation/pending-count?t=${Date.now()}`
          );
          setSupervisorEvalCount(res.data?.count || 0);
        } catch {
          // Silently fail
        }
      }
    };

    const fetchExaminerEvalCount = async () => {
      const effectiveRole = isMultiRole ? "dosen" : activeRole;
      if (effectiveRole === "dosen") {
        try {
          interface Evaluation {
            status: string;
          }
          interface ScheduleItem {
            evaluations?: Evaluation[];
          }
          const res = await api.get(
            `/dosen/seminar-schedules/examiner?t=${Date.now()}`
          );
          const seminars: ScheduleItem[] = res.data?.data?.seminars || [];
          const defenses: ScheduleItem[] = res.data?.data?.ta_defenses || [];

          const pendingSeminars = seminars.filter((s) =>
            s.evaluations?.some((e) => e.status === "PENDING")
          ).length;
          const pendingDefenses = defenses.filter((d) =>
            d.evaluations?.some((e) => e.status === "PENDING")
          ).length;

          setExaminerEvalCount(pendingSeminars + pendingDefenses);
        } catch {
          // Silently fail
        }
      }
    };

    fetchUnread();
    fetchSupervisorEvalCount();
    fetchExaminerEvalCount();

    // Check period registration for mahasiswa
    const checkRegistration = async () => {
      if (activeRole === "mahasiswa") {
        try {
          const res = await api.get("/mahasiswa/my-period");
          setIsRegistered(!!res.data?.period);
        } catch {
          setIsRegistered(false);
        }
      }
    };
    checkRegistration();

    const handleRegistrationComplete = () => {
      checkRegistration();
    };
    window.addEventListener(
      "registration-complete",
      handleRegistrationComplete
    );

    return () => {
      window.removeEventListener(
        "registration-complete",
        handleRegistrationComplete
      );
    };
  }, [user, activeRole, isMultiRole]);

  // Fetch group status for menu availability check
  useEffect(() => {
    if (activeRole === "mahasiswa" && isRegistered) {
      api
        .get("/mahasiswa/group")
        .then((res) => setGroupStatus(res.data.group?.status || null))
        .catch(() => setGroupStatus(null));
    }
  }, [activeRole, isRegistered]);

  // Handle mahasiswa menu conditions
  const isMenuDisabledByStatus = (menuTitle: string): boolean => {
    const pdc1RequiredMenus = ["Progress & Docs", "Schedules", "Evaluations"];
    if (!pdc1RequiredMenus.includes(menuTitle)) return false;
    if (!groupStatus) return true;
    const allowedStatuses = [
      "PDC1_ACTIVE",
      "READY_FOR_SEMPRO",
      "SEMPRO_DONE",
      "PDC2_ACTIVE",
      "PDC2_READY_FOR_EXPO",
      "EXPO_REGISTERED",
      "EXPO_DONE",
      "READY_FOR_TA_INDIVIDUAL",
      "CLOSED",
    ];
    return !allowedStatuses.includes(groupStatus);
  };
  const getTooltipMessage = (menuTitle: string, url: string) => {
    const isMahasiswa = activeRole === "mahasiswa";
    const isRegistrationItem = url === "/mahasiswa/registration";
    const isDashboardItem = url === "/mahasiswa/dashboard";
    const isUnregistered =
      isMahasiswa &&
      isRegistered === false &&
      !isRegistrationItem &&
      !isDashboardItem;
    const isDisabledByStatus = isMahasiswa && isMenuDisabledByStatus(menuTitle);

    if (isUnregistered) return "Register for a period first";
    if (isDisabledByStatus) return "Available after PDC1 starts";
    return menuTitle;
  };

  const isItemDisabled = (menuTitle: string, url: string) => {
    const isMahasiswa = activeRole === "mahasiswa";
    const isRegistrationItem = url === "/mahasiswa/registration";
    const isDashboardItem = url === "/mahasiswa/dashboard";
    const isUnregistered =
      isMahasiswa &&
      isRegistered === false &&
      !isRegistrationItem &&
      !isDashboardItem;
    const isDisabledByStatus = isMahasiswa && isMenuDisabledByStatus(menuTitle);
    return isUnregistered || isDisabledByStatus;
  };

  // ─── Render multi-role sidebar ──────────────────────────
  const renderMultiRoleSidebar = (
    openCategory: string | null,
    setOpenCategory: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    const adminSectionId = "section-admin";
    const dosenSectionId = "section-dosen";

    const handleCategoryOpenChange = (categoryId: string, isOpen: boolean) => {
      if (isOpen) {
        setOpenCategory(categoryId);
      } else if (openCategory === categoryId) {
        setOpenCategory(null);
      }
    };

    // const renderSubItems = (items: { title: string; url: string; icon?: React.ElementType }[], parentLabel: string) => {
    //     return items.map((subItem) => (
    //         <SidebarMenuSubItem key={subItem.title}>
    //             <SidebarMenuSubButton
    //                 asChild
    //                 isActive={pathname === subItem.url}
    //             >
    //                 <Link href={subItem.url} className="flex items-center justify-between w-full">
    //                     <div className="flex items-center">
    //                         <span>{subItem.title}</span>
    //                     </div>
    //                     {subItem.title === 'Supervisor Evaluation' && supervisorEvalCount > 0 && (
    //                         <span className="ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-primary-foreground text-xs font-bold">
    //                             {supervisorEvalCount > 99 ? '99+' : supervisorEvalCount}
    //                         </span>
    //                     )}
    //                     {subItem.title === 'Evaluate Students' && (examinerEvalCount + supervisorEvalCount) > 0 && (
    //                         <span className="ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-primary-foreground text-xs font-bold">
    //                             {(examinerEvalCount + supervisorEvalCount) > 99 ? '99+' : (examinerEvalCount + supervisorEvalCount)}
    //                         </span>
    //                     )}
    //                 </Link>
    //             </SidebarMenuSubButton>
    //         </SidebarMenuSubItem>
    //     ));
    // };

    const renderCategorySection = (item: NavItem, idx: number) => {
      const sectionId =
        categoryIds[item.title] ||
        item.title.toLowerCase().replace(/\s+/g, "-");
      const hasActiveSubitem = item.items?.some((sub) => pathname === sub.url);
      return (
        <SidebarCategoryCollapsible
          key={idx}
          sectionId={sectionId}
          label={item.title}
          icon={item.icon}
          isOpen={openCategory === sectionId}
          onOpenChange={(isOpen) => handleCategoryOpenChange(sectionId, isOpen)}
          isActive={!!hasActiveSubitem}
        >
          {item.items?.map((subItem) => {
            const disabled = isItemDisabled(subItem.title, subItem.url);
            return (
              <SidebarMenuSubItem
                key={subItem.title}
                isActive={pathname === subItem.url}
              >
                <SidebarMenuSubButton
                  asChild
                  isActive={pathname === subItem.url}
                  className={disabled ? "pointer-events-none opacity-50" : ""}
                >
                  <Link
                    href={subItem.url}
                    className={`flex w-full min-w-0 items-center justify-between gap-2 ${disabled ? "pointer-events-none" : ""}`}
                  >
                    <div className="flex min-w-0 items-center">
                      <span className="truncate">{subItem.title}</span>
                    </div>
                    {subItem.title === "Supervisor Evaluation" &&
                      supervisorEvalCount > 0 && (
                        <span className="bg-primary text-primary-foreground flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold">
                          {supervisorEvalCount > 99
                            ? "99+"
                            : supervisorEvalCount}
                        </span>
                      )}
                    {subItem.title === "Evaluate Students" &&
                      examinerEvalCount > 0 && (
                        <span className="bg-primary text-primary-foreground flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold">
                          {examinerEvalCount > 99 ? "99+" : examinerEvalCount}
                        </span>
                      )}
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarCategoryCollapsible>
      );
    };

    return (
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center justify-between px-2 py-2">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="Logo" width={32} height={32} />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">SICATA</span>
                <span className="truncate text-xs">
                  Sistem Informasi Capstone & TA
                </span>
              </div>
            </div>
            <button
              onClick={toggleSidebar}
              className="hover:bg-sidebar-accent flex h-8 w-8 items-center justify-center rounded-md"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {/* Main Menu */}
          <SidebarGroup>
            <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/"}
                    tooltip="Dashboard"
                  >
                    <Link href="/">
                      <LayoutDashboard />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Admin Categories */}
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.admin.map((item, idx) =>
                  renderCategorySection(item, idx)
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Dosen Categories */}
          <SidebarGroup>
            <SidebarGroupLabel>Dosen</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.dosen.map((item, idx) =>
                  renderCategorySection(item, idx)
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Notifications */}
          <SidebarGroup>
            <SidebarGroupLabel>System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/notifications"}
                    tooltip="Notifications"
                  >
                    <Link href="/notifications" className="relative">
                      <Bell />
                      <span>Notifications</span>
                      {unreadCount > 0 && (
                        <span className="bg-primary text-primary-foreground ml-auto flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold">
                          {unreadCount > 99 ? "99+" : unreadCount}
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
              <SidebarMenuButton
                asChild
                isActive={pathname === "/admin/settings"}
                tooltip="Settings"
              >
                <Link href="/admin/settings">
                  <Settings />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={logout}
                tooltip="Logout"
                className="text-red-500 hover:text-red-600"
              >
                <LogOut />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    );
  };

  // ─── Render single-role sidebar (existing behavior) ─────
  const renderSingleRoleSidebar = (
    openItem: string | null,
    setOpenItem: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    const handleItemOpenChange = (itemTitle: string, isOpen: boolean) => {
      if (isOpen) {
        setOpenItem(itemTitle);
      } else if (openItem === itemTitle) {
        setOpenItem(null);
      }
    };

    return (
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center justify-between px-2 py-2">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="Logo" width={32} height={32} />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">SICATA</span>
                <span className="truncate text-xs">
                  Sistem Informasi Capstone & TA
                </span>
              </div>
            </div>
            <button
              onClick={toggleSidebar}
              className="hover:bg-sidebar-accent flex h-8 w-8 items-center justify-center rounded-md"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Dashboard link */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === `/${currentRole}/dashboard`}
                    tooltip="Dashboard"
                  >
                    <Link href={`/${currentRole}/dashboard`}>
                      <LayoutDashboard />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {roleNavItems.map((item) => {
                  const isItemActive = pathname === item.url;
                  const hasActiveSubitem = item.items?.some(
                    (sub) => pathname === sub.url
                  );
                  const isDefaultOpen = isItemActive || hasActiveSubitem;
                  const disabled = isItemDisabled(item.title, item.url || "");
                  const disableParent = disabled;

                  if (item.items && item.items.length > 0) {
                    const itemIsOpen = openItem === item.title;
                    return (
                      <Collapsible
                        key={item.title}
                        asChild
                        open={itemIsOpen}
                        onOpenChange={(isOpen) =>
                          handleItemOpenChange(item.title, isOpen)
                        }
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              tooltip={getTooltipMessage(
                                item.title,
                                item.url || ""
                              )}
                              isActive={!!hasActiveSubitem}
                              className={disableParent ? "opacity-50" : ""}
                            >
                              {item.icon && <item.icon />}
                              <span>{item.title}</span>
                              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.items.map((subItem) => {
                                let subItemDisabled = disableParent;
                                if (
                                  !subItemDisabled &&
                                  subItem.title === "Daftar Expo"
                                ) {
                                  const expoStatuses = [
                                    "PDC2_READY_FOR_EXPO",
                                    "EXPO_REGISTERED",
                                    "EXPO_DONE",
                                    "READY_FOR_TA_INDIVIDUAL",
                                    "TA_IN_PROGRESS",
                                    "CLOSED",
                                  ];
                                  if (
                                    !expoStatuses.includes(groupStatus || "")
                                  ) {
                                    subItemDisabled = true;
                                  }
                                }
                                return (
                                  <SidebarMenuSubItem
                                    key={subItem.title}
                                    isActive={pathname === subItem.url}
                                  >
                                    <SidebarMenuSubButton
                                      asChild
                                      isActive={pathname === subItem.url}
                                      className={
                                        subItemDisabled
                                          ? "pointer-events-none opacity-50"
                                          : ""
                                      }
                                    >
                                      <Link
                                        href={subItem.url}
                                        className={`flex w-full min-w-0 items-center justify-between gap-2 ${subItemDisabled ? "pointer-events-none" : ""}`}
                                      >
                                        <div className="flex min-w-0 items-center">
                                          <span className="truncate">
                                            {subItem.title}
                                          </span>
                                        </div>
                                        {subItem.title ===
                                          "Supervisor Evaluation" &&
                                          supervisorEvalCount > 0 && (
                                            <span className="bg-primary text-primary-foreground flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold">
                                              {supervisorEvalCount > 99
                                                ? "99+"
                                                : supervisorEvalCount}
                                            </span>
                                          )}
                                        {subItem.title ===
                                          "Evaluate Students" &&
                                          examinerEvalCount > 0 && (
                                            <span className="bg-primary text-primary-foreground flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold">
                                              {examinerEvalCount > 99
                                                ? "99+"
                                                : examinerEvalCount}
                                            </span>
                                          )}
                                      </Link>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                );
                              })}
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
                        tooltip={getTooltipMessage(item.title, item.url || "")}
                        className={
                          disabled ? "cursor-not-allowed opacity-50" : ""
                        }
                      >
                        <Link
                          href={item.url!}
                          className={disabled ? "pointer-events-none" : ""}
                        >
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

          {/* Notifications */}
          <SidebarGroup>
            <SidebarGroupLabel>System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/notifications"}
                    tooltip="Notifications"
                  >
                    <Link href="/notifications" className="relative">
                      <Bell />
                      <span>Notifications</span>
                      {unreadCount > 0 && (
                        <span className="bg-primary text-primary-foreground ml-auto flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold">
                          {unreadCount > 99 ? "99+" : unreadCount}
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
            {currentRole === "admin" && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/admin/settings"}
                  tooltip="Settings"
                >
                  <Link href="/admin/settings">
                    <Settings />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={logout}
                tooltip="Logout"
                className="text-red-500 hover:text-red-600"
              >
                <LogOut />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    );
  };

  // ─── Render ──────────────────────────────────────────────
  if (isMultiRole) {
    return renderMultiRoleSidebar(openCategory, setOpenCategory);
  }

  return renderSingleRoleSidebar(openItem, setOpenItem);
}
