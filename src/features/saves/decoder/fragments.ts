/** Split an Unreal struct/array at its own commas, preserving nested and quoted values. */
export function members(value: string): string[] | null {
    if (!value.startsWith('(') || !value.endsWith(')')) return null;
    const result: string[] = [];
    let start = 1, depth = 0, quoted = false;
    for (let index = 1; index < value.length - 1; index++) {
        const char = value[index];
        if (quoted && char === '\\') { index++; continue; }
        if (char === '"') quoted = !quoted;
        if (quoted) continue;
        if (char === '(' && ++depth > 128) return null;
        if (char === ')' && --depth < 0) return null;
        if (char === ',' && depth === 0) {
            result.push(value.slice(start, index));
            start = index + 1;
        }
    }
    if (quoted || depth !== 0) return null;
    if (start < value.length - 1) result.push(value.slice(start, -1));
    return result;
}

export function field(value: string, name: string): string | undefined {
    const matches = members(value)?.filter(member => member.startsWith(`${name}=`));
    return matches?.length === 1 ? matches[0].slice(name.length + 1) : undefined;
}

export function fragmentFields(fragment: string, prefix: string): ReadonlyMap<string, string> | null {
    const entries = members(fragment.slice(prefix.length));
    if (!entries) return null;
    const fields = new Map<string, string>();
    for (const entry of entries) {
        const index = entry.indexOf('=');
        if (index < 1) return null;
        const name = entry.slice(0, index);
        if (fields.has(name)) return null;
        fields.set(name, entry.slice(index + 1));
    }
    return fields;
}
