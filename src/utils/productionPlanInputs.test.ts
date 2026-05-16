import { describe, expect, it } from 'vitest';
import type { Base, BaseBuilding } from '../state/db';
import {
    buildBasesById,
    getFlowInputBuildings,
    getInputAvailabilityKey,
    resolveInputBuilding,
    resolveLinkedOutput,
} from './productionPlanInputs';

function linkedInput(sourceBaseId: string, sourceBuildingId: string): BaseBuilding {
    return {
        id: 'input_linked_ore',
        buildingTypeId: 'package_receiver',
        sectionType: 'inputs',
        selectedItemId: 'ore_iron',
        ratePerMinute: 60,
        linkedOutput: {
            baseId: sourceBaseId,
            buildingId: sourceBuildingId,
            itemIdSnapshot: 'ore_iron',
            ratePerMinuteSnapshot: 60,
        },
    };
}

function makeSourceBase(outputOverrides?: Partial<BaseBuilding>): Base {
    return {
        id: 'base_source',
        name: 'Source',
        buildings: [{
            id: 'output_ore',
            buildingTypeId: 'package_dispatcher',
            sectionType: 'outputs',
            selectedItemId: 'ore_copper',
            ratePerMinute: 120,
            ...outputOverrides,
        }],
        productions: [],
    };
}

describe('production plan linked inputs', () => {
    it('resolves linked inputs from the current source output values', () => {
        const bases: Base[] = [makeSourceBase()];

        const resolved = resolveInputBuilding(linkedInput('base_source', 'output_ore'), bases);

        expect(resolved.linkedOutputStatus).toBe('ok');
        expect(resolved.selectedItemId).toBe('ore_copper');
        expect(resolved.ratePerMinute).toBe(120);
    });

    it('returns non-linked inputs unchanged by reference', () => {
        const manual: BaseBuilding = {
            id: 'input_manual',
            buildingTypeId: 'package_receiver',
            sectionType: 'inputs',
            selectedItemId: 'ore_iron',
            ratePerMinute: 60,
        };

        const resolved = resolveInputBuilding(manual, []);

        expect(resolved).toBe(manual);
        expect(resolved.linkedOutputStatus).toBeUndefined();
    });

    it('reports missing-base when source base does not exist', () => {
        const resolved = resolveInputBuilding(linkedInput('nonexistent_base', 'output_ore'), []);

        expect(resolved.linkedOutputStatus).toBe('missing-base');
        expect(resolved.selectedItemId).toBe('ore_iron');
        expect(resolved.ratePerMinute).toBe(60);
    });

    it('reports missing-output when source building does not exist', () => {
        const bases: Base[] = [makeSourceBase()];
        const resolved = resolveInputBuilding(linkedInput('base_source', 'nonexistent_output'), bases);

        expect(resolved.linkedOutputStatus).toBe('missing-output');
    });

    it('reports unconfigured-output when source output has no item or rate', () => {
        const bases: Base[] = [makeSourceBase({ selectedItemId: undefined, ratePerMinute: undefined })];
        const resolved = resolveInputBuilding(linkedInput('base_source', 'output_ore'), bases);

        expect(resolved.linkedOutputStatus).toBe('unconfigured-output');
        expect(resolved.selectedItemId).toBe('ore_iron');
        expect(resolved.ratePerMinute).toBe(60);
    });

    it('falls back to snapshot values when resolution fails', () => {
        const input = linkedInput('missing_base', 'missing_output');
        input.selectedItemId = 'overridden';
        input.ratePerMinute = 999;

        const resolved = resolveInputBuilding(input, []);

        expect(resolved.selectedItemId).toBe('ore_iron');
        expect(resolved.ratePerMinute).toBe(60);
    });

    it('filters broken linked inputs out of flow input buildings', () => {
        const inputs = getFlowInputBuildings([
            linkedInput('missing_base', 'missing_output'),
        ], []);

        expect(inputs).toEqual([]);
    });

    it('keeps valid linked inputs in flow input buildings', () => {
        const bases: Base[] = [makeSourceBase()];
        const inputs = getFlowInputBuildings([
            linkedInput('base_source', 'output_ore'),
        ], bases);

        expect(inputs).toHaveLength(1);
        expect(inputs[0].selectedItemId).toBe('ore_copper');
    });

    it('works with a pre-built Map<string, Base>', () => {
        const bases: Base[] = [makeSourceBase()];
        const basesMap = buildBasesById(bases);

        const resolved = resolveInputBuilding(linkedInput('base_source', 'output_ore'), basesMap);

        expect(resolved.linkedOutputStatus).toBe('ok');
        expect(resolved.selectedItemId).toBe('ore_copper');
    });
});

describe('resolveLinkedOutput', () => {
    it('returns unconfigured-output when input has no linkedOutput', () => {
        const result = resolveLinkedOutput({ linkedOutput: undefined }, []);
        expect(result.status).toBe('unconfigured-output');
    });

    it('returns ok with sourceBase and sourceOutput for valid link', () => {
        const bases: Base[] = [makeSourceBase()];
        const result = resolveLinkedOutput(linkedInput('base_source', 'output_ore'), bases);

        expect(result.status).toBe('ok');
        expect(result.sourceBase?.id).toBe('base_source');
        expect(result.sourceOutput?.id).toBe('output_ore');
    });
});

describe('getInputAvailabilityKey', () => {
    it('returns linked-output key for linked inputs', () => {
        const input = linkedInput('base_a', 'output_1');
        expect(getInputAvailabilityKey(input, 'base_b')).toBe('linked-output:base_a:output_1');
    });

    it('returns manual-input key for non-linked inputs', () => {
        const manual: BaseBuilding = {
            id: 'input_1',
            buildingTypeId: 'receiver',
            sectionType: 'inputs',
        };
        expect(getInputAvailabilityKey(manual, 'base_x')).toBe('manual-input:base_x:input_1');
    });
});
