/** Platform crypto; called only by the asynchronous import adapters/decoder. */
export async function sha256(bytes: BufferSource): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return `sha256:${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
