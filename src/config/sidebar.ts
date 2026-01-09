import type { LucideIcon } from "lucide-react";
import {
  AlarmClock,
  LayoutDashboard,
  DoorOpen,
  UserCheck,
  IdCard,
  Settings,
  History,
  BadgeCheck,
  LogOut,
} from "lucide-react";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  {
    id: "late-arrivals",
    label: "Llegadas Tarde",
    href: "/llegadas-tarde",
    icon: AlarmClock,
  },
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "authorize-exits",
    label: "Autorizar Salidas",
    href: "/autorizar-salidas",
    icon: DoorOpen,
  },
  {
    id: "authorize-staff",
    label: "Autorizar Personal",
    href: "/autorizar-personal",
    icon: UserCheck,
  },
  {
    id: "visitors",
    label: "Visitantes",
    href: "/visitantes",
    icon: IdCard,
  },
  {
    id: "admin",
    label: "Administración",
    href: "/administracion",
    icon: Settings,
  },
  {
    id: "history",
    label: "Historial",
    href: "/historial",
    icon: History,
  },
  {
    id: "verify-exits",
    label: "Verificar Salidas",
    href: "/verificar-salidas",
    icon: BadgeCheck,
  },
  {
    id: "logout",
    label: "Cerrar Sesión",
    href: "/logout",
    icon: LogOut,
  },
];
