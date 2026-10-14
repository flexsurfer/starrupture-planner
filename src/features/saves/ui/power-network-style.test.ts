// @vitest-environment node
import { expect, it } from 'vitest';
import { powerNetworkStyles } from './power-network-style';

it('gives sparse network IDs distinct colors, including zero, independently of entity order and duplicates', () => {
    const ids = [0, 7, 14, 21, 28, 35, 42];
    const styles = powerNetworkStyles(ids);
    expect(new Set([...styles.values()].map(style => style.color)).size).toBe(ids.length);
    expect(powerNetworkStyles([null, ...[...ids].reverse(), 0, 42, null])).toEqual(styles);
    expect(powerNetworkStyles([null, null])).toEqual(new Map());
});

it('distinguishes reused colors with border patterns before repeating a color and pattern combination', () => {
    const styles = [...powerNetworkStyles(Array.from({ length: 21 }, (_, index) => index)).values()];
    expect(new Set(styles.map(style => `${style.color}:${style.borderStyle}`)).size).toBe(styles.length);
    const firstColor = styles.filter(style => style.color === styles[0].color);
    expect(firstColor.map(style => style.borderStyle)).toEqual(['solid', 'dashed', 'dotted']);
});
