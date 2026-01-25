import { regCoeffect, regEffect } from "@flexsurfer/reflex";
import { EFFECT_IDS } from "./effect-ids";
import type { DataVersion, Base } from "./db";

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
    try {
        localStorage.setItem('bases', JSON.stringify(bases));
    } catch (e) {
        console.error('Error saving bases to local storage:', e);
    }
});

regCoeffect(EFFECT_IDS.GET_BASES, (coeffects) => {
    try {
        const stored = localStorage.getItem('bases');
        if (stored) {
            coeffects.localStoreBases = JSON.parse(stored);
        }
    } catch (e) {
        console.error('Error loading bases from local storage:', e);
        coeffects.localStoreBases = null;
    }
    return coeffects;
}); 