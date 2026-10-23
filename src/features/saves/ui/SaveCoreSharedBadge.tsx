import { useTranslation } from '@/shared/i18n';
import { SharedCoverage } from '@/shared/ui/SharedCoverage';
import type { SaveCoreOverview } from '../overview';

export function SaveCoreSharedBadge({ coreOverview }: { coreOverview: SaveCoreOverview }) {
    const { t } = useTranslation();
    const cores = [...new Map(coreOverview.buildingDetails
        .filter(detail => detail.cores.length > 1)
        .flatMap(detail => detail.cores.map(core => [core.id, core] as const))).values()];
    if (!cores.length) return null;
    const names = cores.sort((a, b) => a.number - b.number)
        .map(core => core.name ?? t('Core {number}', { number: core.number })).join(' + ');
    return <span className="absolute -right-1 -bottom-1 flex rounded-full bg-base-100 p-0.5">
        <SharedCoverage names={names} />
    </span>;
}
