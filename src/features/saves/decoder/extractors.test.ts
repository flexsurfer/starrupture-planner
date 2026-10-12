// @vitest-environment node
import { expect, it } from 'vitest';
import { analyzeSave } from './analyze';
import { extractionContext, extractionFixture } from './test-fixture';

it('retains all extractor instances with version, item and node purity but no stored rates', () => {
    const snapshot = analyzeSave(extractionFixture(), extractionContext);
    const extractors = snapshot.cores.flatMap(core => core.buildings).filter(building => building.configuration.kind === 'extractor');
    expect(extractors.map(building => building.configuration)).toEqual([
        ...['impure', 'normal', 'pure', 'impure', 'normal', 'pure'].map(nodePurity => ({ kind: 'extractor', itemId: 'ore_titanium', nodePurity })),
        { kind: 'extractor', itemId: 'helium', nodePurity: 'not-applicable' },
    ]);
    expect(extractors.map(building => building.buildingTypeId)).toEqual(['ore_excavator', 'ore_excavator', 'ore_excavator', 'mechanicaldrilltier2', 'mechanicaldrilltier2', 'mechanicaldrilltier2', 'helium_extractor']);
    expect(snapshot.cores[1].buildings.some(building => building.id === 106)).toBe(true);
    expect(JSON.stringify(extractors)).not.toMatch(/rate|disabled|crafting|source/);
});
it('does not infer node purity or items from unknown recipes or inventory', () => {
    const save = extractionFixture();
    save.itemData.Mass.entities['(ID=100)'].fragmentValues = ['/Script/Chimera.CrCraftingFragment(SelectedRecipe="unknown")'];
    const extractor = analyzeSave(save, extractionContext).cores[0].buildings.find(building => building.id === 100)!;
    expect(extractor.configuration).toEqual({ kind: 'extractor', itemId: null, nodePurity: null });
});
