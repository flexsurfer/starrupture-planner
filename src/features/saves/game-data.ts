import type { Building, Item } from '@/app/uklad/model';
import type { SaveMappings } from './decoder/mappings';
import type { SaveBuildingConfiguration, SaveNodePurity } from './snapshot';

/** Version-specific save metadata loaded alongside the regular game catalogs. Never persisted. */
export interface SaveBuildingCatalog {
    revision: string;
    kinds: Record<string, SaveBuildingConfiguration['kind']>;
    extractionRates: Record<string, number | null>;
}

export function createSaveBuildingCatalog(mappings: SaveMappings, buildings: Building[]): SaveBuildingCatalog {
    const byId = new Map(buildings.map(building => [building.id, building]));
    const kinds: SaveBuildingCatalog['kinds'] = {};
    const extractionRates: SaveBuildingCatalog['extractionRates'] = {};
    for (const mapping of mappings.buildings.values()) {
        if (mapping.role === 'core') continue;
        kinds[mapping.id] = mapping.extractor ? 'extractor' : mapping.role
            ?? (byId.get(mapping.id)?.recipes?.length ? 'production' : 'other');
        for (const recipe of mapping.extractor?.recipes.values() ?? []) {
            extractionRates[`${mapping.id}:${recipe.itemId}:${recipe.purity}`] = recipe.ratePerMinute;
        }
    }
    return { revision: mappings.mappingRevision, kinds, extractionRates };
}

/** Pure indexes over the selected catalogs; the runtime subscription owns their lifetime. */
export function createSaveGameData(buildings: Building[], items: Item[], metadata: SaveBuildingCatalog | null) {
    return {
        buildings: new Map(buildings.map(building => [building.id, building])),
        items: new Map(items.map(item => [item.id, item])),
        recipes: new Map<string, { buildingId: string; recipe: NonNullable<Building['recipes']>[number] }>(buildings.flatMap(building => (building.recipes ?? []).map((recipe, index) =>
            [`${building.id}:${recipe.id ?? index}`, { buildingId: building.id, recipe }] as const))),
        metadata,
    };
}
export type SaveGameData = ReturnType<typeof createSaveGameData>;

export function extractionRate(data: SaveGameData, buildingTypeId: string, itemId: string | null, purity: SaveNodePurity | null): number | null {
    return data.metadata?.extractionRates[`${buildingTypeId}:${itemId}:${purity}`] ?? null;
}
