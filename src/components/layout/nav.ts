"use client";

import {
  BadgeCheck,
  Briefcase,
  Dumbbell,
  FileText,
  LayoutDashboard,
  Library,
  MessageSquare,
  Mic,
  PenTool,
  ShieldCheck,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label?: string;
  links: NavLink[];
}

const studentGroups: NavGroup[] = [
  { links: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Learn",
    links: [
      { href: "/ask", label: "Ask Doubt", icon: MessageSquare },
      { href: "/vault", label: "Study Vault", icon: Library },
      { href: "/cowork", label: "CoWork", icon: Briefcase },
    ],
  },
  {
    label: "Practise",
    links: [
      { href: "/solve", label: "Solve", icon: PenTool },
      { href: "/voice", label: "Voice", icon: Mic },
      { href: "/viva", label: "Viva", icon: Target },
      { href: "/practice", label: "Practice", icon: Dumbbell },
      { href: "/sample-paper", label: "Sample Paper", icon: FileText },
    ],
  },
  { label: "Get help", links: [{ href: "/teachers", label: "Teachers", icon: Users }] },
];

const teacherGroups: NavGroup[] = [
  {
    links: [
      { href: "/teacher-dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/teacher/onboarding", label: "Verification", icon: BadgeCheck },
    ],
  },
];

const adminGroup: NavGroup = { label: "Admin", links: [{ href: "/admin/teachers", label: "Review Teachers", icon: ShieldCheck }] };

/** Navigation for the signed-in role. Admins without a profile only get the review console. */
export function useNavGroups(): { groups: NavGroup[]; isAdmin: boolean } {
  const { profile } = useAuth();
  const isAdmin = useIsAdmin();
  if (isAdmin && !profile) return { groups: [adminGroup], isAdmin };
  const base = profile?.role === "teacher" ? teacherGroups : studentGroups;
  return { groups: isAdmin ? [...base, adminGroup] : base, isAdmin };
}

/** A link is active on its own page and on any page nested below it. */
export function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
}
