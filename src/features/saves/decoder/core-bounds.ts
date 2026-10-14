import { isValidSaveBounds, type SaveBounds, type SavePosition } from '../snapshot';
import { field } from './fragments';

function vector(value: string | undefined): SavePosition | null {
    if (!value) return null;
    const coordinates = ['X', 'Y', 'Z'].map(axis => field(value, axis));
    if (coordinates.some(coordinate => !coordinate || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(coordinate))) return null;
    const [x, y, z] = coordinates.map(Number);
    return { x, y, z };
}

/** Optional geometry: absent, ambiguous or invalid cached bounds stay unknown. */
export function readCoreBounds(fragments: string[]): SaveBounds | null {
    const prefix = '/Script/Chimera.CrMassBuildingBaseCoreFragment';
    const matches = fragments.filter(fragment => fragment.startsWith(`${prefix}(`));
    if (matches.length !== 1) return null;
    const value = field(matches[0].slice(prefix.length), 'CachedBoundingBox');
    if (!value || field(value, 'IsValid') !== 'True') return null;
    const min = vector(field(value, 'Min')), max = vector(field(value, 'Max'));
    if (!min || !max) return null;
    const bounds = { min, max };
    return isValidSaveBounds(bounds) ? bounds : null;
}
