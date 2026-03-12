import { Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/hooks/useI18n";

export function DashboardEmptyState() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <Eye size={48} className="text-primary" strokeWidth={1.5} />
      <div className="text-center space-y-2">
        <p className="text-[18px] font-medium">{t("dashboard.empty.title")}</p>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.empty.description")}
        </p>
      </div>
      <button
        onClick={() => navigate("/activities/new")}
        className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-base hover:opacity-90 transition-opacity min-h-[44px]"
      >
        {t("dashboard.empty.button")}
      </button>
    </div>
  );
}
