import type {
    Base,
    BaseBuilding,
    CorporationLevelSelection,
    PlanRequiredBuilding,
    Production,
} from './db';

const BASES_STORAGE_KEY = 'bases';
const BASES_SCHEMA_VERSION = 2 as const;

export interface BasesStorageEnvelope {
    schemaVersion: number;
    bases: unknown;
}

function isBasesStorageEnvelope(value: unknown): value is BasesStorageEnvelope {
    if (typeof value !== 'object' || value === null) return false;

    const envelope = value as BasesStorageEnvelope;
    return typeof envelope.schemaVersion === 'number' && 'bases' in envelope;
}

export function writeBasesToStorage(bases: Base[]) {
    const envelope: BasesStorageEnvelope = {
        schemaVersion: BASES_SCHEMA_VERSION,
        bases,
    };

    localStorage.setItem(BASES_STORAGE_KEY, JSON.stringify(envelope));
}

function normalizeBases(rawBases: unknown): Base[] {
    if (!Array.isArray(rawBases)) {
        return [];
    }

    const normalizeBuilding = (rawBuilding: unknown): BaseBuilding | null => {
        if (typeof rawBuilding !== 'object' || rawBuilding === null) {
            return null;
        }

        const building = rawBuilding as Partial<BaseBuilding>;
        if (
            typeof building.id !== 'string' ||
            typeof building.buildingTypeId !== 'string' ||
            typeof building.sectionType !== 'string'
        ) {
            return null;
        }

        const selectedItemId = typeof building.selectedItemId === 'string'
            ? building.selectedItemId
            : undefined;
        const ratePerMinute = typeof building.ratePerMinute === 'number' && Number.isFinite(building.ratePerMinute)
            ? building.ratePerMinute
            : undefined;

        const normalized: BaseBuilding = {
            id: building.id,
            buildingTypeId: building.buildingTypeId,
            sectionType: building.sectionType,
        };

        if (selectedItemId !== undefined) normalized.selectedItemId = selectedItemId;
        if (ratePerMinute !== undefined) normalized.ratePerMinute = ratePerMinute;

        return normalized;
    };

    const normalizeCorporationLevel = (rawLevel: unknown): CorporationLevelSelection | null => {
        if (typeof rawLevel !== 'object' || rawLevel === null) return null;
        const level = rawLevel as Partial<CorporationLevelSelection>;
        if (typeof level.corporationId !== 'string') return null;
        if (typeof level.level !== 'number' || !Number.isFinite(level.level)) return null;
        return {
            corporationId: level.corporationId,
            level: level.level,
        };
    };

    const normalizeRequiredBuilding = (rawRequired: unknown): PlanRequiredBuilding | null => {
        if (typeof rawRequired !== 'object' || rawRequired === null) return null;
        const required = rawRequired as Partial<PlanRequiredBuilding>;
        if (typeof required.buildingId !== 'string') return null;
        if (typeof required.count !== 'number' || !Number.isFinite(required.count)) return null;
        return {
            buildingId: required.buildingId,
            count: required.count,
        };
    };

    const normalizeProduction = (rawProduction: unknown): Production | null => {
        if (typeof rawProduction !== 'object' || rawProduction === null) {
            return null;
        }

        const production = rawProduction as Partial<Production>;
        if (
            typeof production.id !== 'string' ||
            typeof production.name !== 'string' ||
            typeof production.selectedItemId !== 'string' ||
            typeof production.targetAmount !== 'number' ||
            !Number.isFinite(production.targetAmount)
        ) {
            return null;
        }

        const normalized: Production = {
            id: production.id,
            name: production.name,
            selectedItemId: production.selectedItemId,
            targetAmount: production.targetAmount,
        };

        if (typeof production.active === 'boolean') {
            normalized.active = production.active;
        }

        if (production.status === 'active' || production.status === 'inactive' || production.status === 'error') {
            normalized.status = production.status;
        }

        const normalizedCorporationLevel = normalizeCorporationLevel(production.corporationLevel);
        if (normalizedCorporationLevel !== null) {
            normalized.corporationLevel = normalizedCorporationLevel;
        }

        if (Array.isArray(production.inputs)) {
            normalized.inputs = production.inputs
                .map((rawInput) => normalizeBuilding(rawInput))
                .filter((building): building is BaseBuilding => building !== null);
        }

        if (Array.isArray(production.requiredBuildings)) {
            normalized.requiredBuildings = production.requiredBuildings
                .map((rawRequired) => normalizeRequiredBuilding(rawRequired))
                .filter((required): required is PlanRequiredBuilding => required !== null);
        }

        return normalized;
    };

    const normalizedBases: Base[] = [];

    for (const rawBase of rawBases) {
        if (typeof rawBase !== 'object' || rawBase === null) {
            continue;
        }

        const base = rawBase as Partial<Base>;
        if (typeof base.id !== 'string' || typeof base.name !== 'string' || !Array.isArray(base.buildings)) {
            continue;
        }

        const buildings = base.buildings
            .map((rawBuilding) => normalizeBuilding(rawBuilding))
            .filter((building): building is BaseBuilding => building !== null);

        const productions = Array.isArray(base.productions)
            ? base.productions
                .map((rawProduction) => normalizeProduction(rawProduction))
                .filter((production): production is Production => production !== null)
            : [];

        // Normalize coreLevel: must be a number between 0-4, default to 0 if missing/invalid
        const coreLevel = typeof base.coreLevel === 'number' && 
            Number.isFinite(base.coreLevel) && 
            base.coreLevel >= 0 && 
            base.coreLevel <= 4
            ? base.coreLevel
            : 0;

        normalizedBases.push({
            id: base.id,
            name: base.name,
            coreLevel,
            buildings,
            productions,
        });
    }

    return normalizedBases;
}

export function readBasesFromStorage(): Base[] | null {
    const stored = localStorage.getItem(BASES_STORAGE_KEY);
    if (!stored) return null;

    const raw = JSON.parse(stored) as unknown;

    // Legacy format: raw array under "bases" key.
    if (Array.isArray(raw)) {
        const normalized = normalizeBases(raw);
        writeBasesToStorage(normalized);
        return normalized;
    }

    // Current format: envelope with schemaVersion and bases.
    if (isBasesStorageEnvelope(raw)) {
        const normalized = normalizeBases(raw.bases);

        // Rewrite when schema changes in the future or payload isn't an array.
        if (raw.schemaVersion !== BASES_SCHEMA_VERSION || !Array.isArray(raw.bases)) {
            writeBasesToStorage(normalized);
        }

        return normalized;
    }

    // Unknown/corrupt shape.
    return [];
}
