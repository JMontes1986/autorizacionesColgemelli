import type { FC } from "react";
import { Link, useLocation } from "react-router-dom";

import { navItems } from "../config/sidebar";

const Sidebar: FC = () => {
  const location = useLocation();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-slate-50">
      <nav className="mt-4 flex flex-col gap-2 px-3">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              to={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition
              ${
                isActive
                  ? "bg-red-500 text-white shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
