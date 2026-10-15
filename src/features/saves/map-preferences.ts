export interface MapDisplaySettings {
    buildingSize: number;
    showNames: boolean;
    showResources: boolean;
    showGrid: boolean;
    animateCargo: boolean;
}

export interface MapLayers { showLinks: boolean; showBounds: boolean; showPowerNetworks: boolean }

export const defaultMapDisplay: MapDisplaySettings = {
    buildingSize: 72, showNames: false, showResources: true, showGrid: true, animateCargo: true,
};
export const defaultMapLayers: MapLayers = { showLinks: true, showBounds: true, showPowerNetworks: false };

const record = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function normalizeMapDisplay(value: unknown): MapDisplaySettings {
    const input = record(value);
    return {
        buildingSize: typeof input.buildingSize === 'number' && [56, 72, 88].includes(input.buildingSize) ? input.buildingSize : defaultMapDisplay.buildingSize,
        showNames: typeof input.showNames === 'boolean' ? input.showNames : defaultMapDisplay.showNames,
        showResources: typeof input.showResources === 'boolean' ? input.showResources : defaultMapDisplay.showResources,
        showGrid: typeof input.showGrid === 'boolean' ? input.showGrid : defaultMapDisplay.showGrid,
        animateCargo: typeof input.animateCargo === 'boolean' ? input.animateCargo : defaultMapDisplay.animateCargo,
    };
}

export function normalizeMapLayers(value: unknown): MapLayers {
    const input = record(value);
    return {
        showLinks: typeof input.showLinks === 'boolean' ? input.showLinks : defaultMapLayers.showLinks,
        showBounds: typeof input.showBounds === 'boolean' ? input.showBounds : defaultMapLayers.showBounds,
        showPowerNetworks: typeof input.showPowerNetworks === 'boolean' ? input.showPowerNetworks : defaultMapLayers.showPowerNetworks,
    };
}
