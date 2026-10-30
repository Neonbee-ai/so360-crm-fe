import { describe, it, expect, afterEach, vi } from 'vitest';
import { gridPrefsApi } from './crmService';

describe('crmService empty response body', () => {
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

    it('Given no saved grid prefs (empty 200 body) / When columns are fetched / Then null is returned and no error is logged', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true, status: 200, text: async () => '', headers: { get: () => null },
        }));
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const res = await gridPrefsApi.getColumns('crm_dashboard_layout');
        expect(res).toBeNull();
        expect(err).not.toHaveBeenCalled();
    });
});
