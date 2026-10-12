import type { Building, Item } from '@/app/uklad/model';
import type { DataVersion } from '@/features/app-shell/data-version';
import type { SaveMappings } from './mappings';

export interface SaveDataContext { dataVersion: DataVersion; buildings: Building[]; items: Item[] }
export interface SaveDecodeContext {
    dataVersion: DataVersion;
    buildingIds: ReadonlySet<string>;
    itemIds: ReadonlySet<string>;
    mappings: SaveMappings;
}
