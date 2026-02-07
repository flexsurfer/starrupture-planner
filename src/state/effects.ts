import { regCoeffect, regEffect } from "@flexsurfer/reflex";
import { EFFECT_IDS } from "./effect-ids";
import type { DataVersion, Base } from "./db";
import { readBasesFromStorage, writeBasesToStorage } from "./bases-storage";

const BASES_PERSIST_DEBOUNCE_MS = 500;

let pendingBasesForPersist: Base[] | null = null;
let pendingPersistTimer: ReturnType<typeof setTimeout> | null = null;
let isLifecycleFlushRegistered = false;

const flushPendingBasesPersist = () => {
    if (pendingPersistTimer !== null) {
        clearTimeout(pendingPersistTimer);
        pendingPersistTimer = null;
    }

    if (pendingBasesForPersist === null) return;
    try {
        writeBasesToStorage(pendingBasesForPersist);
    } catch (e) {
        console.error('Error saving bases to local storage:', e);
    } finally {
        pendingBasesForPersist = null;
    }
};

const registerBasesLifecycleFlushHandlers = () => {
    if (isLifecycleFlushRegistered) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const flushIfNeeded = () => {
        flushPendingBasesPersist();
    };

    window.addEventListener('pagehide', flushIfNeeded);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flushIfNeeded();
        }
    });

    isLifecycleFlushRegistered = true;
};

registerBasesLifecycleFlushHandlers();

regEffect(EFFECT_IDS.SET_THEME, ( newTheme: 'light' | 'dark') => {
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
}); 

regCoeffect(EFFECT_IDS.GET_THEME, (coeffects) => {
    coeffects.localStoreTheme = localStorage.getItem('theme') as 'light' | 'dark';
    return coeffects;
});

regEffect(EFFECT_IDS.SET_DATA_VERSION, (version: DataVersion) => {
    localStorage.setItem('dataVersion', version);
});

regCoeffect(EFFECT_IDS.GET_DATA_VERSION, (coeffects) => {
    coeffects.localStoreDataVersion = localStorage.getItem('dataVersion') as DataVersion | null;
    return coeffects;
});

regEffect(EFFECT_IDS.SET_BASES, (bases: Base[]) => {
    pendingBasesForPersist = bases;
    if (pendingPersistTimer !== null) return;
    pendingPersistTimer = setTimeout(flushPendingBasesPersist, BASES_PERSIST_DEBOUNCE_MS);
});

regCoeffect(EFFECT_IDS.GET_BASES, (coeffects) => {
    try {
        coeffects.localStoreBases = readBasesFromStorage();
    } catch (e) {
        console.error('Error loading bases from local storage:', e);
        coeffects.localStoreBases = null;
    }
    return coeffects;
}); 
