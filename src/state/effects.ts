import { dispatch, regCoeffect, regEffect } from "@flexsurfer/reflex";
import { EFFECT_IDS } from "./effect-ids";
import { EVENT_IDS } from "./event-ids";
import type { DataVersion, Base, EnergyGroup } from "./db";
import { gameDataBundleToAppVersioned, loadGameDataVersion } from "./gameDataLoader";
import { readBasesFromStorage, writeBasesToStorage } from "./bases-storage";
import { readEnergyGroupsFromStorage, writeEnergyGroupsToStorage } from "./energy-groups-storage";

const BASES_PERSIST_DEBOUNCE_MS = 500;

let pendingBasesForPersist: Base[] | null = null;
let pendingBasesPersistTimer: ReturnType<typeof setTimeout> | null = null;
let isLifecycleFlushRegistered = false;

const flushPendingBasesPersist = () => {
    if (pendingBasesPersistTimer !== null) {
        clearTimeout(pendingBasesPersistTimer);
        pendingBasesPersistTimer = null;
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

regEffect(EFFECT_IDS.LOAD_GAME_DATA, (version: DataVersion) => {
    void loadGameDataVersion(version)
        .then((raw) => {
            dispatch([EVENT_IDS.APP_SET_DATA_VERSION, version, gameDataBundleToAppVersioned(raw)]);
        })
        .catch((e) => {
            console.error('Failed to load game data:', e);
            window.alert('Could not load game data. Check your connection and reload the page.');
            dispatch([EVENT_IDS.APP_GAME_DATA_LOAD_FAILED]);
        });
});

regEffect(EFFECT_IDS.SET_BASES, (bases: Base[]) => {
    pendingBasesForPersist = bases;
    if (pendingBasesPersistTimer !== null) return;
    pendingBasesPersistTimer = setTimeout(flushPendingBasesPersist, BASES_PERSIST_DEBOUNCE_MS);
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

regEffect(EFFECT_IDS.SET_ENERGY_GROUPS, (energyGroups: EnergyGroup[]) => {
    try {
        writeEnergyGroupsToStorage(energyGroups);
    } catch (e) {
        console.error('Error saving energy groups to local storage:', e);
    }
});

regCoeffect(EFFECT_IDS.GET_ENERGY_GROUPS, (coeffects) => {
    try {
        coeffects.localStoreEnergyGroups = readEnergyGroupsFromStorage();
    } catch (e) {
        console.error('Error loading energy groups from local storage:', e);
        coeffects.localStoreEnergyGroups = [];
    }
    return coeffects;
}); 
