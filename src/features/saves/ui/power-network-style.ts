// Paul Tol's bright qualitative scheme: distinct categories, rather than steps around a hue wheel.
// https://sronpersonalpages.nl/~pault/#fig:scheme_bright
const colors = ['#4477AA', '#EE6677', '#228833', '#CCBB44', '#66CCEE', '#AA3377', '#BBBBBB'] as const;
const borderStyles = ['solid', 'dashed', 'dotted'] as const;

export interface PowerNetworkStyle {
    color: string;
    borderStyle: typeof borderStyles[number];
}

/** Assign against the whole snapshot, so focus, selection and entity order cannot change the styles. */
export function powerNetworkStyles(networkIds: readonly (number | null)[]): Map<number, PowerNetworkStyle> {
    const ids = [...new Set(networkIds.filter(id => id !== null))].sort((a, b) => a - b);
    return new Map(ids.map((id, index) => [id, {
        color: colors[index % colors.length],
        // Reuse a small, distinguishable palette with a second visual cue. Markers also show the network ID.
        borderStyle: borderStyles[Math.floor(index / colors.length) % borderStyles.length],
    }]));
}
