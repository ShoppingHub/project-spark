import { Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function DashboardEmptyState() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <Eye size={48} className="text-primary" strokeWidth={1.5} />
      <div className="text-center space-y-2">
        <p className="text-[18px] font-medium">What do you want to observe?</p>
        <p className="text-sm text-muted-foreground">
          Add a life area to start seeing your trajectory.
        </p>
      </div>
      <button
        onClick={() => navigate("/areas/new")}
        className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-base hover:opacity-90 transition-opacity min-h-[44px]"
      >
        Add your first area
      </button>
    </div>
  );
}
