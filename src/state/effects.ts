import { regCoeffect, regEffect } from "@flexsurfer/reflex";
import { EFFECT_IDS } from "./effect-ids";
import type { DataVersion } from "./db";

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