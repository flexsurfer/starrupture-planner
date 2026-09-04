import { describe, expect, it } from 'vitest';
import type { Building } from '@/app/uklad/model';
import { findItemRecipes } from './recipe-utils';

describe('findItemRecipes', () => {
  it('classifies upgraded recipes and places alternatives last', () => {
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

    const recipes = findItemRecipes('glass', buildings);

    expect(recipes.map(({ recipe }) => recipe.id ?? 'legacy')).toEqual([
      'glass_v2',
      'legacy',
      'glass_alternative',
    ]);
    expect(recipes.map(({ recipeType }) => recipeType)).toEqual([
      'upgrade',
      'standard',
      'alternative',
    ]);
  });
});
