/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string;
    // Declared so services can read the LITERAL `import.meta.env.VITE_SO360_CRM_API`.
    // Vite only substitutes that exact expression at build time — reading the
    // value off a captured `env` object leaves undefined in the built bundle,
    // which previously sent CRM calls to whatever the fallback pointed at.
    readonly VITE_SO360_CRM_API?: string;
    // Add more env variables as needed
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
