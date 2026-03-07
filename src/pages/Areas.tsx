import { useI18n } from "@/hooks/useI18n";

const Areas = () => {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <p className="text-lg text-muted-foreground">{t("areas.title")}</p>
    </div>
  );
};

export default Areas;
