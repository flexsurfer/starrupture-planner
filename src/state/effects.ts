import { regCoeffect, regEffect } from "@flexsurfer/reflex";
import { EFFECT_IDS } from "./effect-ids";

regEffect(EFFECT_IDS.SET_THEME, ( newTheme: 'light' | 'dark') => {
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
}); 

regCoeffect(EFFECT_IDS.GET_THEME, (coeffects) => {
    coeffects.localStoreTheme = localStorage.getItem('theme') as 'light' | 'dark';
    return coeffects;
}); 