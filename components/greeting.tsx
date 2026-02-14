import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export const Greeting = () => {
  const t = useTranslations("chat.greeting");
  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 md:px-8"
      key="overview"
    >
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="font-semibold text-xl md:text-2xl"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5 }}
      >
        {t("helloThere")}
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-xl text-zinc-500 md:text-xl"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
      >
        {t("howCanIHelpYouToday")}
      </motion.div>
    </div>
  );
};
