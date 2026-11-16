export const MAX_SAVE_WORKSPACES = 8;
// UTF-16 budgets leave localStorage space for the Planner, My Bases and settings.
export const MAX_SAVES_BYTES = 3 * 1024 * 1024;
export const MAX_WORKSPACE_BYTES = MAX_SAVES_BYTES;
// Bound the expanded collection as well as its compressed storage representation.
export const MAX_DECODED_SAVES_BYTES = 64 * 1024 * 1024;

export class SaveWorkspaceLimitError extends Error {
    constructor() { super('My Saves storage limit exceeded'); }
}
