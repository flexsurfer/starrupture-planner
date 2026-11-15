/** The game reserves UINT32_MAX for a missing reference; strings are not handles. */
export const handle = (value: unknown): number | null =>
    Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) < 4294967295 ? Number(value) : null;

export const entityId = (key: string): number | null => /^\(ID=(0|[1-9]\d*)\)$/.test(key) ? handle(Number(key.slice(4, -1))) : null;
