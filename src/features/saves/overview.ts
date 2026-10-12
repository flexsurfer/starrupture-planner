import type { Building } from '@/app/uklad/model';
import { extractionRate, type SaveGameData } from './game-data';
import type { SaveBuilding, SaveCore, SaveNodePurity } from './snapshot';
import type { SaveWorkspace } from './types';

export type SaveBuildingSection = 'incoming' | 'production' | 'outgoing' | 'energy' | 'infrastructure';
export interface SaveResourceBuilding {
    buildingId: number;
    buildingTypeId: string;
    name: string;
    rate: number | null;
    relatedCore: { id: number; name: string | null; number: number } | null;
    relatedBuilding: { id: number; name: string } | null;
}
export interface SaveResource {
    itemId: string;
    name: string;
    type?: string;
    rate: number | null;
    source: 'extraction' | 'delivery' | 'shipment' | 'corporation' | 'production';
    buildings: SaveResourceBuilding[];
}
export interface SaveBuildingView {
    building: Building;
    instance: SaveBuilding;
    section: SaveBuildingSection;
    resources: SaveResource[];
    nodePurity: SaveNodePurity | null;
}
export interface SavePowerNetwork {
    id: number;
    coreIds: number[];
    powerUse: number | null;
    powerGeneration: number | null;
}
export interface SaveCoreOverview {
    core: SaveCore;
    buildings: SaveBuilding[];
    buildingDetails: SaveBuildingView[];
    incoming: SaveResource[];
    outgoing: SaveResource[];
    corporationShipments: SaveResource[];
    heat: number | null;
    heatCapacity: number | null;
    powerNetworks: SavePowerNetwork[];
}

/** Only summaries combine resources. Their contributing buildings remain individual. */
function combineResources(resources: SaveResource[]): SaveResource[] {
    const result = new Map<string, SaveResource>();
    for (const resource of resources) {
        const key = `${resource.source}:${resource.itemId}`;
        const existing = result.get(key);
        result.set(key, { ...resource, buildings: [...(existing?.buildings ?? []), ...resource.buildings],
            rate: !existing ? resource.rate : existing.rate === null || resource.rate === null ? null : existing.rate + resource.rate });
    }
    return [...result.values()].sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
}
const sum = (values: (number | undefined)[]) => values.some(value => value === undefined) ? null : values.reduce<number>((total, value) => total + (value ?? 0), 0);

export function buildSaveOverview(workspace: SaveWorkspace, data: SaveGameData) {
    const { buildings: saveBuildings, items: saveItemById, recipes: saveRecipes } = data;
    const orderedCores = [...workspace.snapshot.cores].sort((a, b) => a.spawnTimeSeconds - b.spawnTimeSeconds || a.id - b.id);
    const buildings = orderedCores.flatMap(core => core.buildings);
    const byId = new Map(buildings.map(building => [building.id, building]));
    const owners = new Map(orderedCores.flatMap((core, index) => core.buildings.map(building =>
        [building.id, { id: core.id, name: core.name, number: index + 1 }] as const)));
    const senderByReceiver = new Map(buildings.flatMap(building => building.configuration.kind === 'dispatcher' && building.configuration.receiverId !== null
        ? [[building.configuration.receiverId, building] as const] : []));
    const displayName = (building: SaveBuilding) => building.name ?? saveBuildings.get(building.buildingTypeId)?.name ?? building.buildingTypeId;
    const resourcesFor = (building: SaveBuilding): SaveResource[] => {
        const config = building.configuration;
        const resources: SaveResource[] = [];
        const add = (itemId: string | null, rate: number | null, source: SaveResource['source'], peerId?: number) => {
            const item = itemId ? saveItemById.get(itemId) : undefined;
            const peer = peerId === undefined ? undefined : byId.get(peerId);
            if (item) resources.push({ itemId: item.id, name: item.name, type: item.type, rate, source,
                buildings: [{ buildingId: building.id, buildingTypeId: building.buildingTypeId, name: displayName(building), rate,
                    relatedCore: peer ? owners.get(peer.id) ?? null : null,
                    relatedBuilding: peer ? { id: peer.id, name: displayName(peer) } : null }] });
        };
        if (config.kind === 'extractor') add(config.itemId, extractionRate(data, building.buildingTypeId, config.itemId, config.nodePurity), 'extraction');
        if (config.kind === 'production' && config.recipeId) {
            const recipe = saveRecipes.get(config.recipeId)?.recipe;
            if (recipe) add(recipe.output.id, recipe.output.amount_per_minute, 'production');
        }
        // Nominal planning defaults, not measured throughput or save inventory amounts.
        if (config.kind === 'launcher') add(config.itemId, 10, 'corporation');
        if (config.kind === 'dispatcher') add(config.itemId, config.receiverId === null ? null : 240, 'shipment', config.receiverId ?? undefined);
        if (config.kind === 'receiver') {
            const sender = senderByReceiver.get(building.id);
            if (sender?.configuration.kind === 'dispatcher') add(sender.configuration.itemId, 240, 'delivery', sender.id);
        }
        return resources;
    };
    const networkIds = new Set([...orderedCores, ...buildings].flatMap(entity => entity.powerNetworkId === null ? [] : [entity.powerNetworkId]));
    const powerNetworks: SavePowerNetwork[] = [...networkIds].sort((a, b) => a - b).map(id => {
        const members = buildings.filter(building => building.powerNetworkId === id);
        const power = (generator: boolean) => sum(members.filter(building => !saveBuildings.has(building.buildingTypeId) || (saveBuildings.get(building.buildingTypeId)?.type === 'generator') === generator)
            .map(building => saveBuildings.get(building.buildingTypeId)?.power));
        return { id, coreIds: orderedCores.filter(core => core.powerNetworkId === id).map(core => core.id), powerUse: power(false), powerGeneration: power(true) };
    });
    const cores: SaveCoreOverview[] = orderedCores.map(core => {
        const buildingDetails = core.buildings.map((instance): SaveBuildingView => {
            const building = saveBuildings.get(instance.buildingTypeId) ?? { id: instance.buildingTypeId, name: instance.name ?? instance.buildingTypeId };
            const config = instance.configuration;
            const section: SaveBuildingSection = config.kind === 'extractor' || config.kind === 'receiver' ? 'incoming'
                : config.kind === 'dispatcher' || config.kind === 'launcher' ? 'outgoing' : building.type === 'generator' ? 'energy'
                    : config.kind === 'production' ? 'production' : 'infrastructure';
            return { building, instance, section, resources: resourcesFor(instance), nodePurity: config.kind === 'extractor' ? config.nodePurity : null };
        }).sort((a, b) => a.building.name.localeCompare(b.building.name) || a.instance.id - b.instance.id);
        const allResources = buildingDetails.flatMap(detail => detail.resources);
        const interCore = (resource: SaveResource) => resource.buildings.some(building => building.relatedCore && building.relatedCore.id !== core.id);
        const coreNetworks = new Set([core.powerNetworkId, ...core.buildings.map(building => building.powerNetworkId)]);
        const baseHeatCapacity = saveBuildings.get('base_core')?.levels?.find(level => level.level === core.level)?.heatCapacity;
        return { core, buildings: core.buildings, buildingDetails,
            incoming: combineResources(allResources.filter(resource => resource.source === 'extraction' || resource.source === 'delivery' && interCore(resource))),
            outgoing: combineResources(allResources.filter(resource => resource.source === 'shipment' && interCore(resource))),
            corporationShipments: combineResources(allResources.filter(resource => resource.source === 'corporation')),
            heat: sum(core.buildings.map(building => saveBuildings.get(building.buildingTypeId)?.heat)),
            heatCapacity: baseHeatCapacity === undefined || core.buildings.some(building => !saveBuildings.has(building.buildingTypeId)) ? null : baseHeatCapacity
                + buildingDetails.reduce((total, detail) => total + (detail.building.coreHeatCapacity ?? 0), 0),
            powerNetworks: powerNetworks.filter(network => coreNetworks.has(network.id)),
        };
    });
    return { workspace, cores, powerNetworks };
}
export type SaveOverview = ReturnType<typeof buildSaveOverview>;
