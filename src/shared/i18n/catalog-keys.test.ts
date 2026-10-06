import { expect, it } from 'vitest';
import ts from 'typescript';

function findDuplicateKeys(source: string) {
    // Imported JSON has already discarded repeated keys, so inspect the raw syntax tree.
    const file = ts.parseJsonText('catalog.json', source);
    const duplicates: { key: string; firstKey: string; line: number; firstLine: number }[] = [];

    function visit(node: ts.Node) {
        if (ts.isObjectLiteralExpression(node)) {
            const seen = new Map<string, { key: string; line: number }>();
            for (const property of node.properties) {
                if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.name)) continue;
                const key = property.name.text;
                const line = file.getLineAndCharacterOfPosition(property.name.getStart(file)).line + 1;
                const normalized = key.trim();
                const first = seen.get(normalized);
                if (first) duplicates.push({ key, firstKey: first.key, line, firstLine: first.line });
                else seen.set(normalized, { key, line });
            }
        }
        ts.forEachChild(node, visit);
    }

    visit(file);
    return duplicates;
}

const catalogs = import.meta.glob<string>('./locales/*.json', { eager: true, query: '?raw', import: 'default' });
for (const [file, source] of Object.entries(catalogs)) {
    it(`has no duplicate or whitespace-equivalent keys in ${file}`, () => {
        expect(findDuplicateKeys(source), `${file}: duplicate keys and their original line numbers`).toEqual([]);
    });
}

it('reports exact duplicate keys before JSON parsing can overwrite them', () => {
    expect(findDuplicateKeys(`{
  "Description": "First",
  "Description": "Second"
}`)).toEqual([{ key: 'Description', firstKey: 'Description', line: 3, firstLine: 2 }]);
});

it.each([
    ['surrounding whitespace', '{"Description ": "First", " Description": "Second"}', ' Description'],
    ['escaped keys', String.raw`{"Description": "First", "\u0044escription": "Second"}`, 'Description'],
    ['nested plural keys', '{"{count} buildings": {"one": "First", "one": "Second", "other": "Many"}}', 'one'],
])('detects duplicates with %s', (_label, source, key) => {
    expect(findDuplicateKeys(source)).toEqual([expect.objectContaining({ key })]);
});

it('allows different messages to reuse plural keys and translated values', () => {
    expect(findDuplicateKeys(JSON.stringify({
        '{count} buildings': { one: '{count} building', other: '{count} buildings' },
        '{count} bases': { one: '{count} base', other: '{count} bases' },
        'Close': 'Close',
        'Dismiss': 'Close',
    }))).toEqual([]);
});
