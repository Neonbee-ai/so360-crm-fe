import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { crmService } from '../services/crmService';
import { Deal, DealStage } from '../types/crm';
import { Loader2 } from 'lucide-react';
import { StageTransitionModal } from '../components/kanban/StageTransitionModal';

const PipelinePage = () => {
    const navigate = useNavigate();
    const [deals, setDeals] = useState<Deal[]>([]);
    const [stages, setStages] = useState<{ id: string; name: DealStage }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [transitionModal, setTransitionModal] = useState<{
        isOpen: boolean;
        deal: Deal | null;
        newStage: DealStage;
    }>({
        isOpen: false,
        deal: null,
        newStage: 'Lead'
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [dealsData, settings] = await Promise.all([
                    crmService.getDeals(),
                    crmService.getSettings()
                ]);
                setDeals(dealsData);
                setStages(settings.deal_stages as { id: string; name: DealStage }[]);
            } catch (error) {
                console.error('Failed to fetch pipeline data', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleStageChange = (deal: Deal, newStage: DealStage) => {
        setTransitionModal({
            isOpen: true,
            deal,
            newStage
        });
    };

    const confirmStageChange = async (reason: string) => {
        const { deal, newStage } = transitionModal;
        if (!deal) return;

        try {
            await crmService.updateDealStage(deal.id, newStage, reason);
            setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, stage: newStage } : d));
        } catch (error) {
            alert('Failed to update stage');
        }
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center text-slate-500 gap-3">
                <Loader2 className="animate-spin" />
                <span>Loading pipeline...</span>
            </div>
        );
    }

    return (
        <div className="p-8 h-full flex flex-col">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white tracking-tight">Deals Pipeline</h1>
                <p className="text-slate-400 mt-1">Visualize deal movement and sales progress</p>
            </header>

            <div className="flex-1 overflow-hidden">
                <KanbanBoard
                    deals={deals}
                    stages={stages}
                    onDealClick={(deal) => navigate(`../deal/${deal.id}`)}
                    onStageChange={handleStageChange}
                />
            </div>

            <StageTransitionModal
                isOpen={transitionModal.isOpen}
                onClose={() => setTransitionModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmStageChange}
                deal={transitionModal.deal}
                newStage={transitionModal.newStage}
            />
        </div>
    );
};

export default PipelinePage;
