import { archiveFixture } from './test-fixture';
import { describe, expect, it } from 'vitest';
import { createArchive, parseArchive, prepareArchiveImport, selectArchiveImports } from './archive';

describe('planner archive', () => {
    it('round trips complete bases and both plan modes without mutating runtime data', () => {
        const state = archiveFixture();
        const before = JSON.stringify(state);
        const archive = createArchive(state, { baseIds: null, planIds: null });
        expect(parseArchive(JSON.stringify(archive))).toEqual(archive);
        expect(archive.energyGroups).toEqual([{ id: 'grid', name: 'Shared grid' }]);
        expect(archive.bases[1].buildings[0].linkedOutput?.ratePerMinuteSnapshot).toBe(42);
        expect(archive.bases[1].productions[0].inputs?.[0].linkedOutput?.ratePerMinuteSnapshot).toBe(42);
        expect(archive.version).toBe(2);
        expect(archive.plans[0].resources).toEqual(state.plannerTabs[0].resources);
        expect(JSON.stringify(state)).toBe(before);
    });

    it('migrates version 1 resource amounts and drops the old map without requiring the source save', () => {
        const archive = createArchive(archiveFixture(), { baseIds: [], planIds: null });
        const legacy = JSON.parse(JSON.stringify(archive));
        legacy.version = 1;
        for (const plan of legacy.plans) {
            delete plan.resources;
        }
        legacy.plans[0].externalInputs = { plate: 42, wire: 60 };
        const migrated = parseArchive(JSON.stringify(legacy));
        expect(migrated.version).toBe(2);
        expect(migrated.plans[0].resources).toEqual([
            { id: 'legacy-resource-1', itemId: 'plate', ratePerMinute: 42, enabled: true },
            { id: 'legacy-resource-2', itemId: 'wire', ratePerMinute: 60, enabled: true },
        ]);
        expect(migrated.plans[1].resources).toEqual([]);
        for (const plan of migrated.plans) {
            expect(plan).not.toHaveProperty('externalInputs');
        }
        expect(parseArchive(JSON.stringify(migrated))).toEqual(migrated);
    });

    it('honors an explicitly empty resource list over a legacy map', () => {
        const archive = createArchive(archiveFixture(), { baseIds: [], planIds: ['single'] });
        Object.assign(archive, { version: 1 });
        Object.assign(archive.plans[0], { resources: [], externalInputs: { plate: 42 } });
        const plan = parseArchive(JSON.stringify(archive)).plans[0];
        expect(plan.resources).toEqual([]);
        expect(plan).not.toHaveProperty('externalInputs');
    });

    it('drops unknown document and allocation fields at archive boundaries', () => {
        const state = archiveFixture();
        state.plannerComparisonCoreIds = [100];
        Object.assign(state.plannerTabs[0], { unknownField: { saveId: 'unused' } });
        Object.assign(state.plannerTabs[0].resources[1], { unknownField: { buildingId: 42 } });
        const archive = createArchive(state, { baseIds: [], planIds: ['single'] });
        expect(archive.plans[0]).not.toHaveProperty('unknownField');
        expect(archive.plans[0].resources[1]).not.toHaveProperty('unknownField');
        Object.assign(archive.plans[0], { unknownField: 'discard' });
        Object.assign(archive.plans[0].resources[1], { unknownField: 'discard' });
        const imported = parseArchive(JSON.stringify(archive));
        expect(imported.plans[0]).not.toHaveProperty('unknownField');
        expect(imported.plans[0].resources[1]).not.toHaveProperty('unknownField');
        expect(imported).not.toHaveProperty('plannerComparisonCoreIds');
    });

    it('copies independent resource allocations with core attribution', () => {
        const state = archiveFixture();
        const archive = createArchive(state, { baseIds: [], planIds: ['single'] });
        const imported = prepareArchiveImport(parseArchive(JSON.stringify(archive)), 'copy');
        const selected = selectArchiveImports(imported, { baseIds: [], planIds: [imported.plans[0].id] });
        const original = state.plannerTabs[0];
        const copy = selected.plans[0];
        expect(copy.id).not.toBe(original.id);
        expect(copy.resources).toEqual(original.resources);
        expect(copy.resources[1].coreId).toEqual(original.resources[1].coreId);
        copy.resources[1].ratePerMinute = 5;
        copy.resources[1].coreName = 'Changed attribution';
        expect(archive.plans[0]).toEqual(original);
        expect(imported.plans[0].resources).toEqual(original.resources);
        expect(copy).not.toHaveProperty('externalInputs');
    });

    it('exports exactly the selected bases and planner plans, including empty selections', () => {
        const state = archiveFixture();
        const archive = createArchive(state, { baseIds: ['target'], planIds: ['multi'] });
        expect(archive.bases.map(base => base.id)).toEqual(['target']);
        expect(archive.plans.map(plan => plan.id)).toEqual(['multi']);
        const planOnly = createArchive(state, { baseIds: [], planIds: ['single'] });
        expect(planOnly.bases).toEqual([]);
        expect(planOnly.energyGroups).toEqual([]);
        expect(planOnly.plans).toEqual([state.plannerTabs[0]]);
    });

    it('remaps all identity references, sharing input IDs with their plan snapshots', () => {
        const archive = createArchive(archiveFixture(), { baseIds: null, planIds: null });
        const before = JSON.stringify(archive);
        const imported = prepareArchiveImport(archive, 'copy');
        const [source, target] = imported.bases;
        const production = target.productions[0];
        expect(source.id).not.toBe('source');
        expect(target.id).not.toBe('target');
        expect(target.buildings[0].linkedOutput).toMatchObject({ baseId: source.id, buildingId: source.buildings[0].id });
        expect(production.inputs?.[0].id).toBe(target.buildings[0].id);
        expect(production.inputs?.[0].linkedOutput).toMatchObject({ baseId: source.id, buildingId: source.buildings[0].id });
        expect(target.buildings[0].planningOwnerPlanId).toBe(production.id);
        expect(target.buildings[1].planningOwnerPlanId).toBe(production.id);
        expect(target.buildings[1].sourceProductionId).toBe(production.id);
        expect(source.energyGroupId).toBe(imported.energyGroups[0].id);
        expect(target.energyGroupId).toBe(source.energyGroupId);
        expect(imported.plans[0]).toEqual({ ...archive.plans[0], id: imported.plans[0].id });
        expect(imported.plans[1]).toEqual({ ...archive.plans[1], id: imported.plans[1].id });
        expect(imported.plans[0].id).not.toBe(archive.plans[0].id);
        expect(JSON.stringify(archive)).toBe(before);
    });

    it('detaches omitted or missing source bases using saved item and rate', () => {
        const archive = createArchive(archiveFixture(), { baseIds: ['target'], planIds: [] });
        const imported = prepareArchiveImport(archive, 'copy');
        for (const input of [imported.bases[0].buildings[0], imported.bases[0].productions[0].inputs![0]]) {
            expect(input.linkedOutput).toBeUndefined();
            expect(input.selectedItemId).toBe('plate');
            expect(input.ratePerMinute).toBe(42);
        }
    });

    it.each([
        ['bad JSON', '{'],
        ['another format', '{"format":"other","version":1}'],
        ['future version', '{"format":"rupture-planner","version":3}'],
        ['unsafe key', '{"__proto__":{}}'],
    ])('rejects %s', (_, text) => expect(() => parseArchive(text)).toThrow());

    it.each([
        ['duplicate bases', (archive: ReturnType<typeof createArchive>) => archive.bases.push(archive.bases[0])],
        ['duplicate buildings', (archive: ReturnType<typeof createArchive>) => archive.bases[0].buildings.push(archive.bases[0].buildings[0])],
        ['invalid amount', (archive: ReturnType<typeof createArchive>) => { archive.plans[0].targetAmount = -1; }],
        ['missing V2 resources', (archive: ReturnType<typeof createArchive>) => { Reflect.deleteProperty(archive.plans[0], 'resources'); }],
        ['non-array resources', (archive: ReturnType<typeof createArchive>) => { Object.assign(archive.plans[0], { resources: {} }); }],
        ['duplicate resource IDs', (archive: ReturnType<typeof createArchive>) => { archive.plans[0].resources.push(archive.plans[0].resources[0]); }],
        ['invalid resource amount', (archive: ReturnType<typeof createArchive>) => { archive.plans[0].resources[0].ratePerMinute = -1; }],
        ['invalid resource enable state', (archive: ReturnType<typeof createArchive>) => { Object.assign(archive.plans[0].resources[0], { enabled: 'yes' }); }],
        ['invalid core ID', (archive: ReturnType<typeof createArchive>) => { archive.plans[0].resources[1].coreId = 2.5; }],
        ['missing core name', (archive: ReturnType<typeof createArchive>) => { delete archive.plans[0].resources[1].coreName; }],
        ['missing core ID', (archive: ReturnType<typeof createArchive>) => { delete archive.plans[0].resources[1].coreId; }],
        ['invalid production', (archive: ReturnType<typeof createArchive>) => { archive.bases[1].productions[0].targetAmount = Infinity; }],
        ['array-valued production status', (archive: ReturnType<typeof createArchive>) => { Object.assign(archive.bases[1].productions[0], { status: ['active'] }); }],
        ['array-valued flow direction', (archive: ReturnType<typeof createArchive>) => { Object.assign(archive.plans[0], { flowDirection: ['BT'] }); }],
        ['invalid link', (archive: ReturnType<typeof createArchive>) => { archive.bases[1].buildings[0].linkedOutput!.buildingId = ''; }],
        ['empty file', (archive: ReturnType<typeof createArchive>) => { archive.bases = []; archive.plans = []; }],
    ])('rejects the entire archive for %s', (_, change) => {
        const archive = createArchive(archiveFixture(), { baseIds: null, planIds: null });
        change(archive);
        expect(() => parseArchive(JSON.stringify(archive))).toThrow();
    });
});
