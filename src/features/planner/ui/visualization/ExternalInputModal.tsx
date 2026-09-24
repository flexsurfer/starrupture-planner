import { useTranslation } from '@/shared/i18n';
import { useState, type ReactNode } from 'react';
import type { Building, Item } from '@/app/uklad/model';
import { BuildingImage, ItemImage } from '@/shared/ui';

interface ExternalInputModalProps {
    item: Item;
    building?: Building;
    initialAmount: number;
    title?: string;
    children?: ReactNode;
    targetSelector?: ReactNode;
    onClose: () => void;
    onConfirm: (amount: number) => void;
}

export function ExternalInputModal({ item, building, initialAmount, title, children, targetSelector, onClose, onConfirm }: ExternalInputModalProps) {
    const { t } = useTranslation();
    const [amount, setAmount] = useState(String(Number(initialAmount.toFixed(4))));
    const rate = Number(amount);
    const valid = Number.isFinite(rate) && rate > 0;

    return <div className="modal modal-open">
        <form role="dialog" aria-modal="true" aria-label={title ?? t("Use external resource")} className="modal-box max-w-sm space-y-4"
            onSubmit={event => {
                event.preventDefault();
                if (!targetSelector && valid) onConfirm(rate);
            }}>
            <h3 className="text-lg font-semibold">{title ?? t("Use external resource")}</h3>
            <div className="flex items-center gap-3 rounded-lg bg-base-200 p-3">
                <ItemImage itemId={item.id} item={item} size="small" />
                <span className="font-medium">{item.name}</span>
            </div>
            {building && <div className="flex items-center gap-2 text-sm text-base-content/70">
                <BuildingImage buildingId={building.id} building={building} size="small" />
                <span>{building.name}</span>
            </div>}
            {children}
            {targetSelector ?? <>
                <label className="form-control block space-y-1">
                    <span className="text-sm">{t("Available amount / min")}</span>
                    <input autoFocus type="number" min="0" step="any" required className="input input-bordered w-full"
                        value={amount} onChange={event => setAmount(event.target.value)} onFocus={event => event.target.select()} />
                </label>
                <p className="text-xs text-base-content/60">{t("Supplies this resource from outside the production chain. Any remaining demand is calculated automatically.")}</p>
            </>}
            <div className="modal-action">
                <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{t("Cancel")}</button>
                {!targetSelector && <button type="submit" className="btn btn-primary btn-sm" disabled={!valid}>{t("Add input")}</button>}
            </div>
        </form>
        <div className="modal-backdrop" onClick={onClose} />
    </div>;
}
