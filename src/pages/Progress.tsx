import { motion } from "framer-motion";
import { useI18n } from "@/hooks/useI18n";

const Progress = () => {
  const { t } = useI18n();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="flex flex-col px-4 pt-2 pb-8"
    >
      <div className="h-14 flex items-center">
        <h1 className="text-[18px] font-semibold">{t("nav.progress")}</h1>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
        <p className="text-sm text-muted-foreground text-center">Coming soon</p>
      </div>
    </motion.div>
  );
};

export default Progress;
