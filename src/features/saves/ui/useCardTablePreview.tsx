import { useId, useState } from 'react';
import { useTranslation } from '@/shared/i18n';

export function useCardTablePreview<Row>(rows: readonly Row[], limit: number) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const tableId = useId();
    const moreCount = rows.length - limit;

    return {
        tableId,
        visibleRows: expanded ? rows : rows.slice(0, limit),
        toggleButton: moreCount > 0 && <button type="button" className="save-report-disclosure save-report-accent btn btn-ghost btn-sm mt-auto self-start"
            aria-expanded={expanded} aria-controls={tableId} onClick={() => setExpanded(wasExpanded => !wasExpanded)}>
            {expanded ? t('Show less') : t('Show {count} more', { count: moreCount })}
        </button>,
    };
}
