import { fragmentFields } from './fragments';

/** Read configuration only; current recipe, speed and running state are irrelevant to planning. */
export function selectedRecipe(fragments: string[]): string | null {
    const prefix = '/Script/Chimera.CrCraftingFragment';
    const matches = fragments.filter(value => value.startsWith(`${prefix}(`));
    if (matches.length !== 1) return null;
    let value = fragmentFields(matches[0], prefix)?.get('SelectedRecipe');
    if (value?.startsWith('"')) {
        try { value = JSON.parse(value) as string; } catch { return null; }
    }
    return typeof value === 'string' && value !== 'None'
        ? value.match(/^\/Script\/Chimera\.CrItemRecipeData'([^']+)'$/)?.[1] ?? value : null;
}
