/** Preserve unused names; resolve collisions with a single numbered suffix. */
export function availableName(name: string, existingNames: ReadonlySet<string>): string {
    const trimmedName = name.trim();
    if (!existingNames.has(trimmedName)) return trimmedName;
    const baseName = trimmedName.replace(/ \(\d+\)$/, '');
    let number = 2;
    while (existingNames.has(`${baseName} (${number})`)) number++;
    return `${baseName} (${number})`;
}
