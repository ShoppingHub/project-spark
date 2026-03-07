import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { LayoutDashboard, Layers, BarChart2, Settings } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import type { TranslationKey } from "@/i18n/translations";

const tabs: { to: string; icon: typeof LayoutDashboard; labelKey: TranslationKey }[] = [
  { to: "/", icon: LayoutDashboard, labelKey: "nav.home" },
  { to: "/areas", icon: Layers, labelKey: "nav.areas" },
  { to: "/finance", icon: BarChart2, labelKey: "nav.finance" },
  { to: "/settings", icon: Settings, labelKey: "nav.settings" },
];

export function BottomNav() {
  const location = useLocation();
  const { t } = useI18n();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center border-t border-border bg-background">
      {tabs.map(({ to, icon: Icon, labelKey }) => {
        const isActive = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
        return (
          <NavLink
            key={to}
            to={to}
            className="flex flex-1 flex-col items-center justify-center min-h-[44px] gap-0.5"
          >
            <Icon
              size={24}
              className={isActive ? "text-primary" : "text-muted-foreground"}
              strokeWidth={1.5}
            />
            <span
              className={`text-[10px] ${isActive ? "text-primary font-medium" : "text-muted-foreground"}`}
            >
              {t(labelKey)}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}
