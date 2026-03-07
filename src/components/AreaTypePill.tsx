import { cn } from "@/lib/utils";

type AreaType = "health" | "study" | "reduce" | "finance";

const typeStyles: Record<AreaType, string> = {
  health: "bg-[#7DA3A0]/20 text-[#7DA3A0] border-[#7DA3A0]/40",
  study: "bg-[#8C9496]/20 text-[#B9C0C1] border-[#8C9496]/40",
  reduce: "bg-[#BFA37A]/20 text-[#BFA37A] border-[#BFA37A]/40",
  finance: "bg-[#1F4A50] text-[#EAEAEA] border-[#7DA3A0]/30",
};

const typeLabels: Record<AreaType, string> = {
  health: "Health",
  study: "Study",
  reduce: "Reduce",
  finance: "Finance",
};

interface AreaTypePillProps {
  type: AreaType;
  className?: string;
}

export function AreaTypePill({ type, className }: AreaTypePillProps) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-0.5 text-[12px] font-medium border inline-block",
        typeStyles[type],
        className
      )}
    >
      {typeLabels[type]}
    </span>
  );
}
