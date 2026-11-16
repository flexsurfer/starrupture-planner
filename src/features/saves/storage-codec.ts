import { gzipSync, gunzipSync } from 'fflate';
import { MAX_DECODED_SAVES_BYTES, MAX_SAVES_BYTES, SaveWorkspaceLimitError } from './storage-limits';
import type { SaveWorkspace } from './types';

type CompressedSaveWorkspaces = {
    encoding: 'gzip-base64';
    version: 1;
    payload: string;
};
type StoredSaveWorkspaces = CompressedSaveWorkspaces | Record<string, SaveWorkspace>;

export const localStorageBytes = (value: unknown) => JSON.stringify(value).length * 2;
const envelopeBytes = (data: unknown) => localStorageBytes({ v: 1, data });
const invalid = (): never => { throw new Error('Invalid compressed My Saves storage'); };

function base64(bytes: Uint8Array): string {
    const chunks: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
    }
    return btoa(chunks.join(''));
}

// fflate validates DEFLATE structure but does not verify the gzip CRC trailer.
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
    let crc = index;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    return crc >>> 0;
});
function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
    return (crc ^ 0xffffffff) >>> 0;
}

function gzipJson(json: string): CompressedSaveWorkspaces {
    if (json.length > MAX_DECODED_SAVES_BYTES) throw new SaveWorkspaceLimitError();
    const bytes = new TextEncoder().encode(json);
    if (bytes.length > MAX_DECODED_SAVES_BYTES) throw new SaveWorkspaceLimitError();
    return { encoding: 'gzip-base64', version: 1, payload: base64(gzipSync(bytes, { mtime: 0, level: 6 })) };
}

/** Deterministic gzip encoding, also used to read and verify existing compressed records. */
export const encodeSaveWorkspaces = (workspaces: Record<string, SaveWorkspace>) => gzipJson(JSON.stringify(workspaces));

/** Base64 and UTF-8 can expand Unicode-heavy data; persist whichever representation is smaller. */
export function prepareSaveWorkspacesStorage(workspaces: Record<string, SaveWorkspace>): StoredSaveWorkspaces {
    const json = JSON.stringify(workspaces);
    const compressed = gzipJson(json);
    // The outer Persist envelope contributes the same number of code units to both forms.
    return JSON.stringify(compressed).length < json.length ? compressed : workspaces;
}

export function isCompressedSaveStorage(value: unknown): value is CompressedSaveWorkspaces {
    return !!value && typeof value === 'object' && 'encoding' in value && value.encoding === 'gzip-base64'
        && 'version' in value && value.version === 1 && 'payload' in value && typeof value.payload === 'string';
}

/** Legacy plain workspace records pass through the same schema validation as decoded data. */
export function decodeSaveWorkspaces(value: unknown): unknown {
    if (!value || typeof value !== 'object' || !('encoding' in value) || typeof value.encoding !== 'string') return value;
    if (!isCompressedSaveStorage(value)) return invalid();
    if (envelopeBytes(value) > MAX_SAVES_BYTES) throw new SaveWorkspaceLimitError();
    const bytes = Uint8Array.from(atob(value.payload), char => char.charCodeAt(0));
    if (bytes.length < 18) return invalid();
    const trailer = new DataView(bytes.buffer, bytes.byteOffset + bytes.length - 8, 8);
    const length = trailer.getUint32(4, true);
    if (length > MAX_DECODED_SAVES_BYTES) throw new SaveWorkspaceLimitError();
    // One extra byte detects streams that expand beyond their declared size, without unbounded allocation.
    const decoded = gunzipSync(bytes, { out: new Uint8Array(length + 1) });
    if (decoded.length !== length || crc32(decoded) !== trailer.getUint32(0, true)) return invalid();
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decoded));
}

export const saveCollectionStorageBytes = (workspaces: Record<string, SaveWorkspace>) => envelopeBytes(prepareSaveWorkspacesStorage(workspaces));
/** Includes the collection key and Persist envelope, as if this workspace were stored alone. */
export const saveWorkspaceStorageBytes = (workspace: SaveWorkspace) => saveCollectionStorageBytes({ [workspace.id]: workspace });
export const saveStorageDataBytes = (data: StoredSaveWorkspaces) => envelopeBytes(data);
