import { useTranslation } from '@/shared/i18n';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime } from '@/app/uklad/bindings';

export function ExportBaseButton({ baseId, name, iconOnly = false }: { baseId: string; name: string; iconOnly?: boolean }) {
    const { t } = useTranslation();
    const runtime = useRuntime();
    return <button type="button" className={`btn btn-sm btn-ghost shrink-0 ${iconOnly ? "btn-square h-8 min-h-8 w-8 p-0 text-base-content/35 hover:text-base-content/65" : "gap-1 px-2 text-xs"}`} aria-label={t("Export {name}", { name: name })} title={t("Export base")}
        onClick={() => runtime.dispatch([appIds.events.DATA_TRANSFER_EXPORT, { baseIds: [baseId], planIds: [] }])}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />
        </svg>
        {!iconOnly && t("Export")}
    </button>;
}
