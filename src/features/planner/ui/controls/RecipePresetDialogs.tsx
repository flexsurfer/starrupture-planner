import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { RecipeAlternativePreset } from '@/app/uklad/model';
import { useTranslation } from '@/shared/i18n';
import { RecipePresetIcon } from './RecipePresetIcon';
import { isBuiltInRecipePreset, recipePresetName, STANDARD_RECIPE_PRESET_ID } from '@/features/planner/recipe-presets';

function PresetDialog({ title, description, children, footer, onClose }: {
    title: string;
    description?: string;
    children: ReactNode;
    footer: ReactNode;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const titleId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef(onClose);
    useEffect(() => { closeRef.current = onClose; }, [onClose]);
    useEffect(() => {
        const initialFocus = dialogRef.current?.querySelector<HTMLElement>('[data-preset-autofocus]')
            ?? dialogRef.current?.querySelector<HTMLElement>('input, select, button');
        initialFocus?.focus();
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopImmediatePropagation();
            closeRef.current();
        };
        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [title]);

    return <div className="modal modal-open z-[1000] p-2 sm:p-4" onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
            className="modal-box flex w-full max-w-md max-h-[85dvh] flex-col overflow-hidden rounded-xl p-0"
            onKeyDown={event => {
                event.stopPropagation();
                if (event.key !== 'Tab') return;
                const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])');
                if (!focusable?.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }}>
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-base-300 px-4 py-3">
                <div className="min-w-0">
                    <h3 id={titleId} className="text-base font-semibold">{title}</h3>
                    {description && <p className="mt-1 text-xs text-base-content/60">{description}</p>}
                </div>
                <button type="button" className="btn btn-xs btn-square btn-ghost size-7 min-h-7 shrink-0 text-base-content/60" aria-label={t('Close')} onClick={onClose}>
                    <RecipePresetIcon name="close" />
                </button>
            </header>
            <div className="min-h-0 overflow-y-auto overscroll-contain p-4">{children}</div>
            <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-base-300 bg-base-200/30 px-4 py-2.5">{footer}</footer>
        </div>
        <div className="modal-backdrop" onClick={onClose} />
    </div>;
}

interface SaveRecipePresetDialogProps {
    preset?: RecipeAlternativePreset;
    presets: RecipeAlternativePreset[];
    defaultPresetId?: string;
    onClose: () => void;
    onSave: (name: string, makeDefault: boolean) => void;
}

export function SaveRecipePresetDialog({ preset, presets, defaultPresetId, onClose, onSave }: SaveRecipePresetDialogProps) {
    const { t } = useTranslation();
    const formId = useId();
    const [name, setName] = useState(preset ? recipePresetName(preset, t) : '');
    const [defaultOverride, setDefaultOverride] = useState<boolean>();
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    const existing = presets.find(entry => entry.name.toLowerCase() === normalizedName.toLowerCase() || recipePresetName(entry, t).toLowerCase() === normalizedName.toLowerCase());
    const isReservedName = existing !== undefined && isBuiltInRecipePreset(existing.id);
    const makeDefault = defaultOverride ?? (existing !== undefined && existing.id === defaultPresetId);

    return <PresetDialog title={t('Save preset')} description={t('Save your recipe choices to use in other plans.')} onClose={onClose}
        footer={<>
            <button type="button" className="btn btn-xs h-8 min-h-8 btn-ghost px-3" onClick={onClose}>{t('Cancel')}</button>
            <button type="submit" form={formId} className="btn btn-xs h-8 min-h-8 btn-primary px-3" disabled={!normalizedName || isReservedName}>
                {existing && !isReservedName ? t('Replace preset') : t('Save')}
            </button>
        </>}>
        <form id={formId} className="space-y-4" onSubmit={event => {
            event.preventDefault();
            if (normalizedName && !isReservedName) onSave(normalizedName, makeDefault);
        }}>
            <label className="form-control block space-y-1">
                <span className="text-xs font-medium">{t('Preset name')}</span>
                <input data-preset-autofocus type="text" required maxLength={100} className="input input-sm input-bordered h-8 min-h-8 w-full bg-base-200/40"
                    value={name} onChange={event => setName(event.target.value)} />
            </label>
            {existing && <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-base-content/80">{isReservedName ? t('A preset with this name already exists.') : t('Saving will replace "{name}".', { name: existing.name })}</p>}
            <label className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors ${makeDefault ? 'border-primary/40 bg-primary/5' : 'border-base-300 bg-base-200/30'}`}>
                <input type="checkbox" className="checkbox checkbox-xs checkbox-primary mt-0.5" checked={makeDefault}
                    aria-label={t('Make default for new plans')}
                    onChange={event => setDefaultOverride(event.target.checked)} />
                <span className="min-w-0">
                    <span className="block text-xs font-medium">{t('Make default for new plans')}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-base-content/60">{t('Existing plans are not affected.')}</span>
                </span>
            </label>
        </form>
    </PresetDialog>;
}

interface ManageRecipePresetsDialogProps {
    presets: RecipeAlternativePreset[];
    defaultPresetId?: string;
    onClose: () => void;
    onSetDefault: (id: string) => void;
    onDelete: (id: string) => void;
    onRename: (id: string, name: string) => void;
}

function RenameRecipePresetDialog({ preset, presets, onClose, onRename }: {
    preset: RecipeAlternativePreset;
    presets: RecipeAlternativePreset[];
    onClose: () => void;
    onRename: (id: string, name: string) => void;
}) {
    const { t } = useTranslation();
    const formId = useId();
    const errorId = useId();
    const [name, setName] = useState(preset.name);
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    const conflict = presets.some(entry => entry.id !== preset.id && (entry.name.toLowerCase() === normalizedName.toLowerCase() || recipePresetName(entry, t).toLowerCase() === normalizedName.toLowerCase()));
    const canRename = Boolean(normalizedName) && normalizedName !== preset.name && !conflict;
    return <PresetDialog title={t('Rename preset')} onClose={onClose} footer={<>
        <button type="button" className="btn btn-xs h-8 min-h-8 btn-ghost px-3" onClick={onClose}>{t('Cancel')}</button>
        <button type="submit" form={formId} className="btn btn-xs h-8 min-h-8 btn-primary px-3" disabled={!canRename}>{t('Save')}</button>
    </>}>
        <form id={formId} onSubmit={event => {
            event.preventDefault();
            if (canRename) { onRename(preset.id, normalizedName); onClose(); }
        }}>
            <label className="block space-y-1">
                <span className="text-xs font-medium">{t('Preset name')}</span>
                <input data-preset-autofocus type="text" required maxLength={100} className="input input-sm input-bordered h-8 min-h-8 w-full bg-base-200/40"
                    value={name} onChange={event => setName(event.target.value)} aria-invalid={conflict} aria-describedby={conflict ? errorId : undefined} />
            </label>
            {conflict && <p id={errorId} role="alert" className="mt-2 text-xs text-error">{t('A preset with this name already exists.')}</p>}
        </form>
    </PresetDialog>;
}

export function ManageRecipePresetsDialog({ presets, defaultPresetId = STANDARD_RECIPE_PRESET_ID, onClose, onSetDefault, onDelete, onRename }: ManageRecipePresetsDialogProps) {
    const { t } = useTranslation();
    const [deleting, setDeleting] = useState<RecipeAlternativePreset | null>(null);
    const [renaming, setRenaming] = useState<RecipeAlternativePreset | null>(null);
    if (renaming) return <RenameRecipePresetDialog preset={renaming} presets={presets} onClose={() => setRenaming(null)} onRename={onRename} />;
    if (deleting) return <PresetDialog title={t('Delete preset')} onClose={() => setDeleting(null)}
        footer={<>
            <button data-preset-autofocus type="button" className="btn btn-xs h-8 min-h-8 btn-ghost px-3" onClick={() => setDeleting(null)}>{t('Cancel')}</button>
            <button type="button" className="btn btn-xs h-8 min-h-8 btn-error px-3" onClick={() => { onDelete(deleting.id); setDeleting(null); }}>{t('Delete')}</button>
        </>}>
        <p className="text-sm leading-relaxed break-words">{t('Delete "{name}"? Existing plans will keep their recipe choices.', { name: deleting.name })}</p>
        {deleting.id === defaultPresetId && <p className="mt-3 text-xs text-base-content/60">{t('New plans will use "{name}".', { name: t('Standard recipes') })}</p>}
    </PresetDialog>;

    return <PresetDialog title={t('Manage presets')} description={t('Choose how new plans start.')} onClose={onClose}
        footer={<button type="button" className="btn btn-xs h-8 min-h-8 btn-primary min-w-16 px-3" onClick={onClose}>{t('Done')}</button>}>
        <div className="rounded-lg border border-base-300 bg-base-200/40 p-3">
            <label className="block space-y-1.5">
                <span className="text-xs font-medium">{t('Default for new plans')}</span>
                <select className="select select-sm select-bordered h-8 min-h-8 w-full bg-base-100 text-xs"
                    value={defaultPresetId}
                    onChange={event => onSetDefault(event.target.value)}>
                    {presets.map(preset => <option key={preset.id} value={preset.id}>{recipePresetName(preset, t)}</option>)}
                </select>
            </label>
            <p className="mt-2 text-xs leading-relaxed text-base-content/60">{t('Existing plans are not affected.')}</p>
        </div>
        <div className="mt-4">
            <div className="mb-2 flex items-center gap-2">
                <h4 className="text-xs font-medium text-base-content/65">{t('Saved presets')}</h4>
                <span className="text-xs tabular-nums text-base-content/40">{presets.length}</span>
            </div>
            {presets.length === 0 ? <div className="rounded-lg border border-dashed border-base-300 px-4 py-6 text-center">
                <RecipePresetIcon name="presets" className="mx-auto mb-2 size-6 text-base-content/35" />
                <p className="text-sm font-medium">{t('No saved presets yet.')}</p>
                <p className="mt-1 text-xs leading-relaxed text-base-content/55">{t('Save your current recipe choices to create a preset.')}</p>
            </div> : <ul aria-label={t('Saved presets')} className="divide-y divide-base-300">
                {presets.map(preset => <li key={preset.id} className="flex items-center gap-2 py-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded bg-base-200 text-base-content/50"><RecipePresetIcon name="presets" className="size-3.5" /></span>
                    <span className="min-w-0 flex-1 break-words text-xs font-medium">
                        {recipePresetName(preset, t)}
                        {isBuiltInRecipePreset(preset.id) && <span className="ml-2 text-[10px] font-normal text-base-content/50">{t('Built-in')}</span>}
                    </span>
                    {preset.id === defaultPresetId && <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{t('Default')}</span>}
                    {!isBuiltInRecipePreset(preset.id) && <div className="flex shrink-0 gap-1">
                    <button type="button" className="btn btn-xs btn-square btn-ghost size-7 min-h-7 text-base-content/55"
                        aria-label={t('Rename "{name}"', { name: preset.name })} title={t('Rename "{name}"', { name: preset.name })} onClick={() => setRenaming(preset)}>
                        <RecipePresetIcon name="rename" className="size-3.5" />
                    </button>
                    <button type="button" className="btn btn-xs btn-square btn-ghost size-7 min-h-7 text-base-content/45 hover:text-error"
                        aria-label={t('Delete "{name}"', { name: preset.name })} title={t('Delete "{name}"', { name: preset.name })} onClick={() => setDeleting(preset)}>
                        <RecipePresetIcon name="trash" className="size-3.5" />
                    </button>
                    </div>}
                </li>)}
            </ul>}
        </div>
    </PresetDialog>;
}
