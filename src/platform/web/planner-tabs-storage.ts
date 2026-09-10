import { createPlannerTab, type PlannerTab } from '@/features/planner/state';
import { normalizePinnedRecipeSelections } from './legacy-storage/pinned-recipes-storage';

const record = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
const positive = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

/** Storage is untrusted: retain valid tabs and repair individual settings. */
export function normalizePlannerTabs(value: unknown): PlannerTab[] {
    if (!Array.isArray(value)) return [];
    const ids = new Set<string>();
    return value.flatMap(entry => {
        if (!record(entry) || typeof entry.id !== 'string' || !entry.id.trim() || ids.has(entry.id)
            || typeof entry.name !== 'string' || !entry.name.trim()
            || (entry.mode !== 'single' && entry.mode !== 'multi')) return [];
        ids.add(entry.id);
        const tab = createPlannerTab(entry.id, entry.name.trim(), entry.mode);
        tab.selectedItemId = typeof entry.selectedItemId === 'string' && entry.selectedItemId ? entry.selectedItemId : null;
        tab.targetAmount = positive(entry.targetAmount) ? entry.targetAmount : 60;
        tab.recipeSelections = normalizePinnedRecipeSelections(entry.recipeSelections);
        tab.groupByStage = entry.groupByStage === true;
        if (entry.flowDirection === 'LR' || entry.flowDirection === 'RL' || entry.flowDirection === 'TB' || entry.flowDirection === 'BT') {
            tab.flowDirection = entry.flowDirection;
        }
        tab.activeView = entry.activeView === 'table' ? 'table' : 'graph';
        const corporation = entry.selectedCorporationLevel;
        if (record(corporation) && typeof corporation.corporationId === 'string' && corporation.corporationId
            && typeof corporation.level === 'number' && Number.isInteger(corporation.level) && corporation.level >= 0) {
            tab.selectedCorporationLevel = { corporationId: corporation.corporationId, level: corporation.level };
        }
        const targetIds = new Set<string>();
        if (Array.isArray(entry.multiTargets)) tab.multiTargets = entry.multiTargets.flatMap(target => {
            if (!record(target) || typeof target.itemId !== 'string' || !target.itemId
                || targetIds.has(target.itemId) || !positive(target.amount)) return [];
            targetIds.add(target.itemId);
            return [{ itemId: target.itemId, amount: target.amount }];
        });
        return [tab];
    });
}

export const normalizePlannerActiveTabId = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() ? value : null;
