import { render, screen } from '@testing-library/react';
import { PanelBoundary } from './PanelBoundary';

/** An additive panel must never blank the record it sits on. */
function Boom(): JSX.Element {
    throw new TypeError("can't access property \"find\", list is null");
}

describe('PanelBoundary', () => {
    it('Given a panel that throws / When rendered / Then the page survives and the panel is dropped', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(
            <div>
                <p>record body</p>
                <PanelBoundary name="customer-360">
                    <Boom />
                </PanelBoundary>
            </div>,
        );
        expect(screen.getByText('record body')).toBeTruthy();
        expect(warn).toHaveBeenCalledWith(
            '[customer-360] panel failed to render:',
            expect.stringContaining('find'),
        );
        warn.mockRestore();
    });

    it('Given a healthy panel / Then it renders normally', () => {
        render(
            <PanelBoundary name="customer-360">
                <p>panel content</p>
            </PanelBoundary>,
        );
        expect(screen.getByText('panel content')).toBeTruthy();
    });
});
