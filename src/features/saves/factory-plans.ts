import type { Recipe } from '@/app/uklad/model';
import { compareProductionBuildings, getPlannerBuildingStats, getPlannerStatsBuildingRows } from '@/features/planner/building-stats';
import { getPlannerInputBuildings } from '@/features/planner/external-inputs';
import { buildMultiTargetProductionFlow, createRecipeResolver } from '@/features/planner/production-flow';
import { aggregatePlannerResources, groupPlannerCoreAllocations, isValidResourceRate, saveResourceSnapshotKey,
    type PlannerCoreAllocation, type PlannerResource } from '@/features/planner/resources';
import { factoryTargetsFromRates } from './factory-fit';
import { fitNetworkRecipes, type ConfiguredRecipe, type FactoryRecipeFit } from './factory-recipes';
import type { SaveGameData } from './game-data';
import type { SaveBuildingView, SaveCoreReference, SaveOverview } from './overview';

export interface FactoryPlan extends FactoryRecipeFit {
    networkId: number;
    cores: SaveCoreReference[];
    capacity: Record<string, number>;
    resources: PlannerResource[];
}

function networkPlan(networkId: number, members: SaveBuildingView[], data: SaveGameData, workspaceId: string, snapshotKey: string,
    defaultRecipe: (id: string) => Recipe | undefined): FactoryPlan | null {
    const cores = new Map<number, SaveCoreReference>();
    const recipes = new Map<string, { key: string; recipe: Recipe; tier: number; capacity: number }>();
    const ingredients = new Set<string>();
    const allocations: PlannerCoreAllocation[] = [];
    const uncovered = new Map<string, number>();
    for (const { instance, resources, cores: coverage } of members) {
        for (const core of coverage) cores.set(core.id, core);
        const config = instance.configuration;
        if (config.kind === 'production') {
            const key = config.recipeId;
            if (!key) continue;
            const recipe = data.recipes.get(key)?.recipe;
            if (!recipe?.inputs.length || !Number.isFinite(recipe.output.amount_per_minute) || recipe.output.amount_per_minute <= 0) continue;
            for (const input of recipe.inputs) ingredients.add(input.id);
            const line = recipes.get(key) ?? { key, recipe, tier: data.metadata?.tiers[instance.buildingTypeId] ?? 1, capacity: 0 };
            line.capacity += recipe.output.amount_per_minute;
            recipes.set(key, line);
            continue;
        }
        const source = resources[0];
        if (!source || !isValidResourceRate(source.rate)) continue;
        if (!coverage.length) {
            uncovered.set(source.itemId, (uncovered.get(source.itemId) ?? 0) + source.rate);
            continue;
        }
        allocations.push({ itemId: source.itemId, ratePerMinute: source.rate, coreId: coverage[0].id,
            coreName: coverage.map(core => core.name?.trim() || `Core ${core.number}`).join(', '),
            ...(coverage.length > 1 ? { coreIds: coverage.map(core => core.id) } : {}),
            source: { workspaceId, snapshotKey, buildingIds: [instance.id], buildingNames: [source.buildings[0].name] } });
    }

    const capacity: Record<string, number> = {};
    const configured = new Map<string, ConfiguredRecipe[]>();
    // All machines contribute capacity. Planner uses one configured recipe per item.
    const preferred = [...recipes.values()].sort((a, b) => b.tier - a.tier || b.capacity - a.capacity || a.key.localeCompare(b.key));
    for (const line of preferred) {
        const id = line.recipe.output.id;
        const options = configured.get(id);
        if (options) options.push(line);
        else configured.set(id, [line]);
        if (!ingredients.has(id)) capacity[id] = (capacity[id] ?? 0) + line.capacity;
    }
    const targets = Object.keys(capacity);
    if (!targets.length) return null;

    const resources = [...groupPlannerCoreAllocations(allocations), ...[...uncovered].map(([itemId, ratePerMinute]) => ({ itemId, ratePerMinute }))]
        .filter(row => !targets.includes(row.itemId)).map((row, i) => ({ ...row, id: `resource-${i + 1}`, enabled: true }));
    const fit = fitNetworkRecipes(capacity, aggregatePlannerResources(resources), configured, data, defaultRecipe);
    return { networkId, cores: [...cores.values()].sort((a, b) => a.number - b.number), capacity, resources, ...fit };
}

export function buildFactoryPlans(overview: SaveOverview, data: SaveGameData, onlyNetworkId?: number) {
    const groups = new Map<number, SaveBuildingView[]>();
    // The overview contains one row per physical building, including shared Core coverage.
    const networks = new Map(overview.buildingDetails.map(({ instance }) => [instance.id, instance.powerNetworkId]));
    for (const detail of overview.buildingDetails) {
        const { powerNetworkId: network, configuration: { kind } } = detail.instance;
        if (network === null || (onlyNetworkId !== undefined && network !== onlyNetworkId)) continue;
        if (kind === 'receiver') {
            const sender = detail.resources[0]?.buildings[0]?.relatedBuilding;
            const senderNetwork = sender && networks.get(sender.id);
            if (senderNetwork == null || senderNetwork === network) continue;
        } else if (kind !== 'production' && kind !== 'extractor') continue;
        const group = groups.get(network);
        if (group) group.push(detail);
        else groups.set(network, [detail]);
    }
    const snapshotKey = saveResourceSnapshotKey(overview.workspace.snapshot);
    const plans: FactoryPlan[] = [];
    const resolve = createRecipeResolver([...data.buildings.values()]);
    const defaultRecipe = (id: string) => resolve(id)?.recipe;
    for (const [id, members] of groups) {
        const plan = networkPlan(id, members, data, overview.workspace.id, snapshotKey, defaultRecipe);
        if (plan) plans.push(plan);
    }
    return { snapshotKey, plans: plans.sort((a, b) => a.networkId - b.networkId) };
}
export type FactoryPlans = ReturnType<typeof buildFactoryPlans>;

export function getFactoryPlanBuildingRows(plan: FactoryPlan, overview: SaveOverview, data: SaveGameData) {
    if (!plan.targetRates) return [];
    const buildings = [...data.buildings.values()];
    const inputs = getPlannerInputBuildings(aggregatePlannerResources(plan.resources));
    const flow = buildMultiTargetProductionFlow(factoryTargetsFromRates(plan.targetRates), buildings, plan.recipeSelections, inputs);
    const installed = overview.buildingDetails.filter(({ instance }) => instance.powerNetworkId === plan.networkId).map(({ instance }) => instance);
    const comparison = compareProductionBuildings(flow.nodes, installed, buildings, data.metadata);
    return getPlannerStatsBuildingRows(getPlannerBuildingStats(flow.nodes), comparison);
}
