import { useTranslation } from '@/shared/i18n';
interface ItemsStatsProps {
  totalItems: number;
}

export const ItemsStats = ({ totalItems }: ItemsStatsProps) => {
    const { t } = useTranslation();
  return (
      <div  >
        <span className="text-sm font-semibold">{t("Total: ")}</span>
        <span className="text-base font-bold">{totalItems}</span>
      </div>
  );
};
