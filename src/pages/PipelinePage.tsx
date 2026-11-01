import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { crmService } from '../services/crmService';
import { usePersistedState } from '../hooks/useListViewState';
import { Deal, FlowState } from '../types/crm';
import { Loader2, Plus } from 'lucide-react';
import { StageTransitionModal } from '../components/kanban/StageTransitionModal';
import { DealCloseModal } from '../components/kanban/DealCloseModal';
import { dealCloseService, stageKind, LoseDealBody, WinDealBody } from '../services/salesConfigService';
import { toast, ListPageTemplate, Button, SearchInput, Skeleton } from '@so360/design-system';
import CreateDealModal from '../pages/components/CreateDealModal';

import { useDealFilterConfig } from '../pages/components/DealFilters';
import { DealFilters as Filters } from '../types/crm';
import { useNotify, useActivity, useShellBridge } from '@so360/shell-context';
import { useFillViewportHeight } from '../hooks/useFillViewportHeight';
import { RE_FLAGS } from '../hooks/useCrmFeatureFlag';
import ExportMenu, { useCanExport } from '../components/ExportMenu';
import { exportService } from '../services/exportService';

const PipelinePage = () => {
    const navigate = useNavigate();
    const { ref: boardWrapperRef, height: boardHeight } = useFillViewportHeight<HTMLDivElement>();
    const { emitNotification } = useNotify();
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const canCreateDeal = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('deals.create') ?? false) && ((shell?.effectiveFlagsLoaded ?? false) ? (shell?.isFeatureEnabled?.('action:crm:deals:create') ?? true) : true);
    // §48 server-side CSV / Excel / PDF export — RBAC-scoped on the server.
    const canExportDeals = useCanExport('deals.export', RE_FLAGS.DATA_EXPORT);
    const [isCreateDealOpen, setIsCreateDealOpen] = useState(false);
    const [deals, setDeals] = useState<Deal[]>([]);
    const [stages, setStages] = useState<FlowState[]>([]);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isFiltering, setIsFiltering] = useState(false);
    // Filters survive a trip to a deal's detail page and back.
    const [filters, setFilters] = usePersistedState<Filters>('pipeline.filters', {});
    const dealFilterConfig = useDealFilterConfig(filters, setFilters);
    // Company moves out of the drawer into the toolbar search box (same `company_name` filter).
    const filterConfig = {
        ...dealFilterConfig,
        fields: dealFilterConfig.fields.filter((f) => f.key !== 'company_name'),
    };
    const [pollTick, setPollTick] = useState(0);

    const [transitionModal, setTransitionModal] = useState<{
        isOpen: boolean;
        deal: Deal | null;
        newStage: string;
        newStageId: string | null;
    }>({
        isOpen: false,
        deal: null,
        newStage: '',
        newStageId: null
    });

    // Won / lost stages run the real win / lose flow instead of a bare stage move.
    const [closeModal, setCloseModal] = useState<{ deal: Deal; stage: FlowState; kind: 'won' | 'lost' } | null>(null);
    const [closing, setClosing] = useState(false);

    // Debounce filter changes for text inputs; also re-runs on pollTick for auto-refresh
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchData();
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [filters, pollTick]);

    // Auto-refresh pipeline every 60 seconds, but skip the heavy refetch while
    // the tab is hidden — the data is re-fetched on the next visible tick.
    useEffect(() => {
        const pollInterval = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
                return;
            }
            setPollTick(t => t + 1);
        }, 60 * 1000);
        return () => clearInterval(pollInterval);
    }, []);

    const fetchData = async () => {
        try {
            if (!isInitialLoading) {
                setIsFiltering(true);
            }

            const pipelineData = await crmService.getPipeline(filters);
            const fetchedStages = pipelineData.stages || [];

            if (fetchedStages.length === 0) {
                console.warn('No stages found for pipeline');
            }

            setStages(fetchedStages.map(s => ({
                id: s.id,
                name: s.name,
                color: s.color || 'rgb(var(--nb-fg-muted))',
                is_terminal: s.is_terminal ?? false,
            })));

            setDeals(fetchedStages.flatMap(s => s.deals || []));
        } catch (error: any) {
            console.error('Failed to fetch pipeline data', error);
            toast.error(error.message || 'Failed to load pipeline. Please check your connection or Organization settings.');
        } finally {
            setIsInitialLoading(false);
            setIsFiltering(false);
        }
    };

    const handleStageChange = (deal: Deal, newStageId: string) => {
        const stage = stages.find(s => s.id === newStageId);
        if (!stage) return;

        const kind = stageKind(stage as { name?: string; type?: string });
        if (kind !== 'open') {
            setCloseModal({ deal, stage, kind });
            return;
        }

        setTransitionModal({
            isOpen: true,
            deal,
            newStage: stage.name,
            newStageId: newStageId
        });
    };

    const confirmStageChange = async (reason: string) => {
        const { deal, newStage, newStageId } = transitionModal;
        if (!deal || !newStageId) return;

        try {
            await crmService.updateDealStage(deal.id, newStageId, reason);
            const isWon = newStage?.toLowerCase().includes('won');
            const isLost = newStage?.toLowerCase().includes('lost');
            const event = isWon ? 'CRM_DEAL_WON' : isLost ? 'CRM_DEAL_LOST' : 'CRM_DEAL_STAGE_CHANGED';
            recordActivity({ eventType: isWon ? 'deal.won' : isLost ? 'deal.lost' : 'deal.stage_changed', eventCategory: 'crm', description: `Deal "${deal.name}" moved to ${newStage}`, resourceType: 'deal', resourceId: deal.id }).catch(() => {});
            if (isWon || isLost) {
                emitNotification({ event, userIds: deal.owner_id ? [deal.owner_id] : [], variables: { dealName: deal.name, stageName: newStage }, relatedResource: { type: 'deal', id: deal.id } }).catch(() => {});
            }
            setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, current_flow_state: newStageId ?? undefined } : d));
        } catch (error) {
            toast.error('Failed to update stage');
        }
    };

    const finishClose = async (call: () => Promise<unknown>) => {
        if (!closeModal) return;
        const { deal, stage, kind } = closeModal;
        setClosing(true);
        try {
            await call();
            recordActivity({ eventType: kind === 'won' ? 'deal.won' : 'deal.lost', eventCategory: 'crm', description: `Deal "${deal.name}" moved to ${stage.name}`, resourceType: 'deal', resourceId: deal.id }).catch(() => {});
            emitNotification({ event: kind === 'won' ? 'CRM_DEAL_WON' : 'CRM_DEAL_LOST', userIds: deal.owner_id ? [deal.owner_id] : [], variables: { dealName: deal.name, stageName: stage.name }, relatedResource: { type: 'deal', id: deal.id } }).catch(() => {});
            setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, current_flow_state: stage.id } : d));
            setCloseModal(null);
            fetchData();
        } catch (error: any) {
            toast.error(error?.message || `Could not mark the deal as ${kind}`);
        } finally {
            setClosing(false);
        }
    };

    const confirmWin = (body: WinDealBody) => finishClose(() => dealCloseService.win(closeModal!.deal.id, body));
    const confirmLose = (body: LoseDealBody) => finishClose(() => dealCloseService.lose(closeModal!.deal.id, body));

    return (
        <ListPageTemplate
            trail={[]}
            title="Deals Pipeline"
            description="Visualize deal movement and sales progress"
            primaryAction={canCreateDeal ? (
                <Button onClick={() => setIsCreateDealOpen(true)}>
                    <Plus size={16} aria-hidden="true" />
                    New Deal
                </Button>
            ) : undefined}
            headerSecondaryActions={canExportDeals ? [
                <ExportMenu key="export" label="Export deals" onExport={(format) => exportService.deals(filters, format)} />,
            ] : undefined}
            search={
                <SearchInput
                    placeholder="Search deals by company..."
                    value={filters.company_name ?? ''}
                    onChange={(v: string) => setFilters({ ...filters, company_name: v || undefined })}
                />
            }
            filterConfig={filterConfig}
            toolbarEnd={isFiltering ? (
                <div className="flex items-center gap-2 text-info h-nb-control-md px-3">
                    <Loader2 className="animate-spin" size={14} />
                    <span className="text-xs">Refining results...</span>
                </div>
            ) : undefined}
        >
            <div
                ref={boardWrapperRef}
                style={{ height: boardHeight }}
                className={`transition-opacity duration-300 ${isFiltering ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}
            >
                {isInitialLoading ? (
                    <div role="status" aria-busy="true" className="w-full space-y-nb-3 p-nb-4" data-testid="pipeline-loading">
                <Skeleton variant="rect" />
                <Skeleton variant="text" lines={3} />
                <span className="sr-only">Loading pipeline...</span>
            </div>
                ) : (
                <KanbanBoard
                    deals={deals}
                    stages={stages}
                    onDealClick={(deal) => navigate(`../deal/${deal.id}`)}
                    onStageChange={handleStageChange}
                />
                )}
            </div>

            <StageTransitionModal
                isOpen={transitionModal.isOpen}
                onClose={() => setTransitionModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmStageChange}
                deal={transitionModal.deal}
                newStage={transitionModal.newStage}
            />

            <DealCloseModal
                isOpen={!!closeModal}
                kind={closeModal?.kind ?? 'won'}
                deal={closeModal?.deal ?? null}
                stageName={closeModal?.stage.name ?? ''}
                busy={closing}
                onClose={() => setCloseModal(null)}
                onWin={confirmWin}
                onLose={confirmLose}
            />

            {isCreateDealOpen && (
                <CreateDealModal
                    onClose={() => setIsCreateDealOpen(false)}
                    onSuccess={() => { setIsCreateDealOpen(false); fetchData(); }}
                />
            )}
        </ListPageTemplate>
    );
};

export default PipelinePage;
