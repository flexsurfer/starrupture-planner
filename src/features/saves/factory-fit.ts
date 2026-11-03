import type { Recipe } from '@/app/uklad/model';
import { getTargetRecipeOrder } from '@/features/planner/target-conflicts';
import { message, type UiMessage } from '@/shared/i18n/core';

export function factoryTargetsFromRates(rates: Record<string, number>) {
    return Object.entries(rates).map(([itemId, amount]) => ({ itemId, amount }));
}

type FactoryFit = { rates: Record<string, number> } | { missing: string[] } | { error: UiMessage };

export function fitFactoryTargets(capacity: Record<string, number>, supply: Record<string, number>,
    recipeFor: (id: string) => Recipe | undefined, itemName: (id: string) => string): FactoryFit {
    const unavailable = { error: message('Target rates could not be calculated.') };
    const targets = factoryTargetsFromRates(capacity);
    if (!targets.length || targets.some(({ amount }) => !Number.isFinite(amount) || amount <= 0)) return unavailable;
    const { recipes, warning } = getTargetRecipeOrder(Object.keys(capacity), recipeFor, itemName);
    if (warning) return { error: warning };

    // Combine demand from every consumer before spending an item's local supply.
    const steps = [...recipes].reverse().map(([id, recipe]) => ({
        id, available: Object.hasOwn(capacity, id) ? 0 : supply[id] ?? 0, recipe,
    }));
    function missingInputs(scale: number, unlimitedSupply = false) {
        const demand = new Map(targets.map(({ itemId, amount }) => [itemId, amount * scale]));
        const missing: string[] = [];
        for (const { id, available, recipe } of steps) {
            const remaining = (demand.get(id) ?? 0) - available;
            if (remaining <= 0 || (unlimitedSupply && available > 0)) continue;
            if (!recipe?.inputs.length) {
                missing.push(id);
                continue;
            }
            const machines = remaining / recipe.output.amount_per_minute;
            for (const input of recipe.inputs) {
                demand.set(input.id, (demand.get(input.id) ?? 0) + machines * input.amount_per_minute);
            }
        }
        return missing;
    }

    // A delivered intermediate can cover its whole branch even with no local ore.
    const missing = missingInputs(1, true);
    if (missing.length) return { missing };

    const fits = (scale: number) => missingInputs(scale).length === 0;
    // Scale the whole plan together. A single input budget covers every target.
    let high = 1;
    while (fits(high)) {
        high *= 2;
        if (!Number.isFinite(high)) return unavailable;
    }
    let low = high / 2;
    while (!fits(low)) {
        high = low;
        low /= 2;
    }
    if (low === 0) return unavailable;
    for (let i = 0; i < 48; i++) {
        const mid = (low + high) / 2;
        if (fits(mid)) low = mid;
        else high = mid;
    }
    const targetRates = Object.fromEntries(targets.map(({ itemId, amount }) => {
        const rate = Number((amount * low).toPrecision(13));
        return [itemId, Math.floor(rate * 1e6) / 1e6 || rate];
    }));
    return { rates: targetRates };
}
