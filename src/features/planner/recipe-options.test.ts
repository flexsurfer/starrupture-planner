import { describe, expect, it } from 'vitest';
import type { Building, Item } from '@/app/uklad/model';
import { buildRecipeOptionsForOutputItems } from './recipe-options';

describe('buildRecipeOptionsForOutputItems', () => {
    it('keeps alternatives last and resolves legacy indexes to stable recipe IDs', () => {
        const buildings: Building[] = [
            {
                id: 'furnace',
                name: 'Furnace',
                upgrade: 'furnacetier2',
                recipes: [{
                    output: { id: 'glass', amount_per_minute: 320 },
                    inputs: [],
                }],
            },
            {
                id: 'furnacetier2',
                name: 'Furnace v.2',
                recipes: [
                    {
                        id: 'glass_alternative',
                        variant: 'alternative',
                        output: { id: 'glass', amount_per_minute: 40 },
                        inputs: [],
                    },
                    {
                        id: 'glass_v2',
                        output: { id: 'glass', amount_per_minute: 80 },
                        inputs: [],
                    },
                ],
            },
        ];
        const itemsById: Record<string, Item> = {
            glass: { id: 'glass', name: 'Glass', type: 'component' },
        };

        const result = buildRecipeOptionsForOutputItems(
            new Set(['glass']),
            buildings,
            itemsById,
            { glass: 'furnacetier2:1' },
        );

        expect(result).toHaveLength(1);
        expect(result[0]?.options.map(({ key }) => key)).toEqual([
            'furnacetier2:glass_v2',
            'furnace:0',
            'furnacetier2:glass_alternative',
        ]);
        expect(result[0]?.options.map(({ recipeType }) => recipeType)).toEqual([
            'upgrade',
            'standard',
            'alternative',
        ]);
        expect(result[0]?.selectedKey).toBe('furnacetier2:glass_v2');
    });
});
