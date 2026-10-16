import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useModalDialog } from '@/shared/ui/useModalDialog';
import { PlannerResourcesPanel } from './resources';

interface Props { id: string; onClose: () => void; onClearNodeSelection: () => void; focusItemId?: string; initialAmount?: number; requestId?: number }

const isDesktop = () => typeof window.matchMedia !== 'function' || window.matchMedia('(min-width: 1024px)').matches;
const subscribeViewport = (notify: () => void) => {
    if (typeof window.matchMedia !== 'function') return () => {};
    const media = window.matchMedia('(min-width: 1024px)');
    media.addEventListener('change', notify);
    return () => media.removeEventListener('change', notify);
};

/** Keep one panel mounted so resizing never loses a draft or core selection. */
export function PlannerResourcesDock({ id, onClose, onClearNodeSelection, focusItemId, initialAmount, requestId }: Props) {
    const { t } = useTranslation();
    const desktop = useSyncExternalStore(subscribeViewport, isDesktop, () => true);
    const ref = useModalDialog(!desktop);
    useEffect(() => {
        if (!desktop || !ref.current) return;
        const dialog = ref.current;
        const trigger = document.activeElement;
        dialog.show();
        dialog.querySelector<HTMLElement>('[data-dialog-autofocus]')?.focus({ preventScroll: true });
        return () => {
            dialog.close();
            if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
        };
    }, [desktop, ref]);
    return <dialog ref={ref} id={id} role={desktop ? 'complementary' : 'dialog'} aria-label={t('Resources')}
        className={`m-0 max-h-none max-w-none border-0 bg-base-100 p-0 text-base-content ${desktop
            ? 'static z-30 h-full min-h-0 w-[26rem] shrink-0 border-l border-base-300 xl:w-[30rem]'
            : 'fixed inset-0 h-dvh w-screen backdrop:bg-black/40'}`}
        onCancel={event => { event.preventDefault(); onClose(); }}
        onKeyDown={event => {
            if (desktop && event.key === 'Escape' && !event.defaultPrevented) { event.stopPropagation(); onClose(); }
        }}>
        {/* Each card click starts a fresh manual entry, including after cancellation. */}
        <PlannerResourcesPanel key={requestId} onClose={onClose} onClearNodeSelection={onClearNodeSelection}
            focusItemId={focusItemId} initialAmount={initialAmount} />
    </dialog>;
}
