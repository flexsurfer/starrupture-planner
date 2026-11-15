/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_UMAMI_ENABLED: 'true' | 'false';
    readonly VITE_APP_RELEASE: string;
}
