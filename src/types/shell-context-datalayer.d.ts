// Type shim: the committed so360-shell-fe packages/shell-context/dist (what tsc
// resolves through tsconfig paths) predates the dataLayer hooks, although the
// source and the runtime federated module export them. Remove this once that
// dist is rebuilt with `export * from './dataLayer'`.
export {};

declare module '@so360/shell-context' {
    export function useDatasetSchema(
        code: string | null | undefined,
        opts?: { enabled?: boolean; [key: string]: unknown },
    ): {
        schema: unknown;
        fields: unknown[];
        fieldsByKey: Record<string, unknown>;
        isLoading: boolean;
        error: unknown;
        refetch: () => void;
    };
}
