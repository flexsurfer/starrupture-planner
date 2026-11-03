import type { Recipe } from '@/app/uklad/model';
import { message, type UiMessage } from '@/shared/i18n/core';
import { fitFactoryTargets } from './factory-fit';
import type { SaveGameData } from './game-data';

export interface ConfiguredRecipe { key: string; recipe: Recipe }
export interface FactoryRecipeFit {
    recipeSelections: Record<string, string>;
    targetRates: Record<string, number> | null;
    warning: UiMessage | null;
}

/** Find the first supply-backed selection in network preference order. Rates are fitted separately. */
function findSuppliedRecipeSelections(targets: string[], supply: Record<string, number>,
    configured: Map<string, ConfiguredRecipe[]>, defaultRecipe: (id: string) => Recipe | undefined,
    preferred: Record<string, string>): Record<string, string> | null {
    const options = new Map<string, (Recipe | undefined)[]>();
    const collect = (id: string) => {
        if (options.has(id)) return;
        const recipes = configured.get(id)?.map(option => option.recipe) ?? [defaultRecipe(id)];
        options.set(id, recipes);
        for (const recipe of recipes) {
            for (const input of recipe?.inputs ?? []) collect(input.id);
        }
    };
    for (const id of targets) collect(id);
    const alternatives = [...configured].filter(([id, choices]) => options.has(id) && choices.length > 1);
    if (!alternatives.length) return null;

    // Work up from raw items. A delivery can cover an intermediate even if its own
    // ingredients are missing, but Planner still requires an acyclic recipe chain.
    function supportsTargets() {
        const acyclic = new Set<string>();
        const supplied = new Set<string>();
        let previousSize: number;
        do {
            previousSize = acyclic.size + supplied.size;
            for (const [id, recipes] of options) {
                if (supplied.has(id)) continue;
                for (const recipe of recipes) {
                    const inputs = recipe?.inputs ?? [];
                    if (!inputs.every(input => acyclic.has(input.id))) continue;
                    acyclic.add(id);
                    if (supply[id] > 0 || (inputs.length && inputs.every(input => supplied.has(input.id)))) {
                        supplied.add(id);
                        break;
                    }
                }
            }
            if (targets.every(id => supplied.has(id))) return true;
        } while (acyclic.size + supplied.size > previousSize);
        return false;
    }

    const selection = { ...preferred };
    // Discard a choice as soon as any target would lose its last supply path.
    function choose(index: number): boolean {
        if (!supportsTargets()) return false;
        if (index === alternatives.length) return true;
        const [id, choices] = alternatives[index];
        const all = options.get(id)!;
        for (const { key, recipe } of choices) {
            options.set(id, [recipe]);
            selection[id] = key;
            if (choose(index + 1)) return true;
        }
        options.set(id, all);
        return false;
    }
    return choose(0) ? selection : null;
}

export function fitNetworkRecipes(capacity: Record<string, number>, supply: Record<string, number>, configured: Map<string, ConfiguredRecipe[]>,
    data: SaveGameData, defaultRecipe: (id: string) => Recipe | undefined): FactoryRecipeFit {
    const preferred = Object.fromEntries([...configured].map(([id, options]) => [id, options[0].key]));
    const itemName = (id: string) => data.items.get(id)?.name ?? id;
    const fit = (selections: Record<string, string>) => fitFactoryTargets(capacity, supply,
        id => data.recipes.get(selections[id])?.recipe ?? defaultRecipe(id), itemName);
    const original = fit(preferred);
    if ('rates' in original) return { targetRates: original.rates, recipeSelections: preferred, warning: null };
    const missing = 'missing' in original ? original.missing.map(itemName).join(', ') : '';
    const unavailable = { recipeSelections: preferred, targetRates: null,
        warning: 'error' in original ? original.error : message('Missing supply for {items}.', { items: missing }) };
    if (![...configured.values()].some(options => options.length > 1)) return unavailable;

    const fallback = findSuppliedRecipeSelections(Object.keys(capacity), supply, configured, defaultRecipe, preferred);
    if (!fallback) return unavailable;
    const result = fit(fallback);
    if (!('rates' in result)) return unavailable;
    const products = Object.keys(fallback).filter(id => fallback[id] !== preferred[id]).map(itemName).join(', ');
    const warning = missing
        ? message('The preferred recipes need {items}. This plan uses other configured recipes for {products}.', { items: missing, products })
        : message('This plan uses other configured recipes for {products} to avoid a circular dependency.', { products });
    return { targetRates: result.rates, recipeSelections: fallback, warning };
}
