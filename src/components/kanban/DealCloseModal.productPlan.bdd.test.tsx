import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Pulse b1512967 — "Plan from deal products" on the won-deal form.
vi.mock('../common/Modal', () => ({
    Modal: ({ isOpen, children, title }: any) => isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null,
}));
vi.mock('../../hooks/useCrmFeatureFlag', () => ({ useCrmFeatureFlag: () => false }));
vi.mock('../../services/salesConfigService', () => ({ lossReasonsService: { list: vi.fn().mockResolvedValue([]) } }));
const tpl = vi.hoisted(() => ({ getProjectTemplates: vi.fn() }));
vi.mock('../../services/crmService', () => ({ crmService: tpl }));
const shell = vi.hoisted(() => ({ flags: {} as Record<string, { enabled: boolean }>, loaded: true }));
vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({ effectiveFlagsLoaded: shell.loaded, effectiveFlags: shell.flags, isFeatureEnabled: () => true }),
}));

import { DealCloseModal } from './DealCloseModal';

const FLAG = 'submodule:projects:deal_product_plan';
const deal = { id: 'd1', name: 'Big Deal', value: 900 } as any;
const setup = () => {
    const p = { onClose: vi.fn(), onWin: vi.fn(), onLose: vi.fn() };
    render(<DealCloseModal isOpen kind="won" deal={deal} stageName="Won" {...p} />);
    return p;
};
const submit = () => fireEvent.submit(document.querySelector('form')!);
const tickCreateProject = () => fireEvent.click(screen.getByLabelText(/create a project/i));

beforeEach(() => { shell.flags = {}; shell.loaded = true; tpl.getProjectTemplates.mockReset().mockResolvedValue([]); });

describe('Given the deal product plan flag is off', () => {
    it('When a project is requested on win / Then no plan choice shows and the body is as today', () => {
        const p = setup();
        tickCreateProject();
        expect(screen.queryByLabelText('Project plan')).not.toBeInTheDocument();
        submit();
        expect(p.onWin).toHaveBeenCalledWith({ final_value: 900, create_project: true });
    }, 20000);
});

describe('Given the flag matrix has not loaded', () => {
    it('When a project is requested on win / Then the plan choice stays hidden (fail-closed)', () => {
        shell.loaded = false;
        shell.flags = { [FLAG]: { enabled: true } };
        setup();
        tickCreateProject();
        expect(screen.queryByLabelText('Project plan')).not.toBeInTheDocument();
    });
});

describe('Given the deal product plan flag is on', () => {
    beforeEach(() => { shell.flags = { [FLAG]: { enabled: true } }; });

    it('When no project is requested / Then the plan choice is hidden and nothing extra is sent', () => {
        const p = setup();
        expect(screen.queryByLabelText('Project plan')).not.toBeInTheDocument();
        submit();
        expect(p.onWin).toHaveBeenCalledWith({ final_value: 900 });
    });

    it('When a project is requested and the default is kept (Pulse 202244cb) / Then each deal line becomes one task (tasks)', () => {
        const p = setup();
        tickCreateProject();
        expect((screen.getByLabelText('Project plan') as HTMLSelectElement).value).toBe('tasks');
        submit();
        expect(p.onWin).toHaveBeenCalledWith({ final_value: 900, create_project: true, plan_from_products: 'tasks' });
    });

    it('When "Blank project" is chosen / Then plan_from_products is none', () => {
        const p = setup();
        tickCreateProject();
        fireEvent.change(screen.getByLabelText('Project plan'), { target: { value: 'none' } });
        submit();
        expect(p.onWin).toHaveBeenCalledWith({ final_value: 900, create_project: true, plan_from_products: 'none' });
    });
});

// Pulse 202244cb — the same template choice New Project offers.
const TEMPLATES_FLAG = 'submodule:projects:templates';
const ROWS = [
    { id: 'tenant-1', name: 'Kitchen fit-out' },
    { id: 'sys-furn', name: 'Furniture Manufacturing / Small Manufacturing', is_system: true },
];

describe('Given the project templates flag is off', () => {
    it('When a project is requested / Then no template picker shows, nothing is fetched and no template_id is sent', () => {
        const p = setup();
        tickCreateProject();
        expect(screen.queryByLabelText('Project template')).not.toBeInTheDocument();
        expect(tpl.getProjectTemplates).not.toHaveBeenCalled();
        submit();
        expect(p.onWin).toHaveBeenCalledWith({ final_value: 900, create_project: true });
    });
});

describe('Given the project templates flag is on', () => {
    beforeEach(() => { shell.flags = { [TEMPLATES_FLAG]: { enabled: true } }; });

    it('When no project is requested / Then templates are not fetched', () => {
        setup();
        expect(screen.queryByLabelText('Project template')).not.toBeInTheDocument();
        expect(tpl.getProjectTemplates).not.toHaveBeenCalled();
    });

    it('When a project is requested / Then system templates list first after the blank choice', async () => {
        tpl.getProjectTemplates.mockResolvedValue(ROWS);
        setup();
        tickCreateProject();
        await screen.findByRole('option', { name: /Furniture Manufacturing/ });
        const values = Array.from((screen.getByLabelText('Project template') as HTMLSelectElement).options).map((o) => o.value);
        expect(values).toEqual(['', 'sys-furn', 'tenant-1']);
    });

    it('When a template is picked / Then template_id is sent with the win', async () => {
        tpl.getProjectTemplates.mockResolvedValue(ROWS);
        const p = setup();
        tickCreateProject();
        await screen.findByRole('option', { name: /Furniture Manufacturing/ });
        fireEvent.change(screen.getByLabelText('Project template'), { target: { value: 'sys-furn' } });
        submit();
        expect(p.onWin).toHaveBeenCalledWith({ final_value: 900, create_project: true, template_id: 'sys-furn' });
    });

    it('When the blank choice is kept / Then no template_id is sent', async () => {
        tpl.getProjectTemplates.mockResolvedValue(ROWS);
        const p = setup();
        tickCreateProject();
        await screen.findByRole('option', { name: /Furniture Manufacturing/ });
        submit();
        expect(p.onWin).toHaveBeenCalledWith({ final_value: 900, create_project: true });
    });

    it('When the template list fails to load / Then the form still submits without a template and says so', async () => {
        tpl.getProjectTemplates.mockRejectedValue(new Error('down'));
        const p = setup();
        tickCreateProject();
        await screen.findByText(/Templates could not be loaded/, undefined, { timeout: 8000 });
        submit();
        expect(p.onWin).toHaveBeenCalledWith({ final_value: 900, create_project: true });
    });

    it('When both the product plan and templates are on / Then the plan and the template are sent together', async () => {
        shell.flags = { [TEMPLATES_FLAG]: { enabled: true }, [FLAG]: { enabled: true } };
        tpl.getProjectTemplates.mockResolvedValue(ROWS);
        const p = setup();
        tickCreateProject();
        await screen.findByRole('option', { name: /Furniture Manufacturing/ });
        fireEvent.change(screen.getByLabelText('Project template'), { target: { value: 'tenant-1' } });
        submit();
        await waitFor(() => expect(p.onWin).toHaveBeenCalledWith({
            final_value: 900, create_project: true, plan_from_products: 'tasks', template_id: 'tenant-1',
        }));
    });
});
