import React from 'react';
import { Deal } from '../../types/crm';
import { Calendar, TrendingUp, Lock } from 'lucide-react';
import { useCRMFormatters } from '../../utils/formatters';

interface KanbanStage {
    id: string;         // flow state code
    name: string;
    color?: string;
    is_terminal?: boolean;
}

interface KanbanBoardProps {
    deals: Deal[];
    stages: KanbanStage[];
    onDealClick: (deal: Deal) => void;
    onStageChange: (deal: Deal, targetState: string) => void;
}

/** Distance in px from the scroll container's edge that triggers auto-scroll while dragging. */
export const AUTO_SCROLL_EDGE_PX = 80;
/** Max px scrolled per animation frame, reached right at the edge. */
export const AUTO_SCROLL_MAX_SPEED = 18;

export const KanbanBoard = ({ deals, stages, onDealClick, onStageChange }: KanbanBoardProps) => {
    const formatters = useCRMFormatters();
    const [draggedDealId, setDraggedDealId] = React.useState<string | null>(null);
    const [dragOverStage, setDragOverStage] = React.useState<string | null>(null);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const scrollDirection = React.useRef(0); // -1 left, 0 idle, 1 right
    const scrollSpeed = React.useRef(0);
    const rafId = React.useRef<number | null>(null);

    const stopAutoScroll = () => {
        scrollDirection.current = 0;
        scrollSpeed.current = 0;
        if (rafId.current !== null) {
            cancelAnimationFrame(rafId.current);
            rafId.current = null;
        }
    };

    const runAutoScrollLoop = () => {
        const el = scrollRef.current;
        if (!el || scrollDirection.current === 0) {
            rafId.current = null;
            return;
        }
        el.scrollLeft += scrollDirection.current * scrollSpeed.current;
        rafId.current = requestAnimationFrame(runAutoScrollLoop);
    };

    // Auto-scrolls the board horizontally when a card is dragged near the
    // left/right edge, so a stage that's currently off-screen can be reached
    // without releasing the drag — native HTML5 DnD doesn't do this on its own.
    const handleBoardDragOver = (e: React.DragEvent) => {
        const el = scrollRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const distFromLeft = e.clientX - rect.left;
        const distFromRight = rect.right - e.clientX;

        let direction = 0;
        let proximity = 0;
        if (distFromLeft < AUTO_SCROLL_EDGE_PX) {
            direction = -1;
            proximity = AUTO_SCROLL_EDGE_PX - distFromLeft;
        } else if (distFromRight < AUTO_SCROLL_EDGE_PX) {
            direction = 1;
            proximity = AUTO_SCROLL_EDGE_PX - distFromRight;
        }

        if (direction === 0) {
            stopAutoScroll();
            return;
        }

        scrollDirection.current = direction;
        scrollSpeed.current = Math.max(4, Math.min(AUTO_SCROLL_MAX_SPEED, (proximity / AUTO_SCROLL_EDGE_PX) * AUTO_SCROLL_MAX_SPEED));
        if (rafId.current === null) {
            rafId.current = requestAnimationFrame(runAutoScrollLoop);
        }
    };

    const handleDragStart = (e: React.DragEvent, deal: Deal) => {
        setDraggedDealId(deal.id);
        e.dataTransfer.setData('dealId', deal.id);
        e.dataTransfer.effectAllowed = 'move';

        // Add a small delay to make the card semi-transparent while dragging
        setTimeout(() => {
            const target = e.target as HTMLElement;
            target.style.opacity = '0.4';
        }, 0);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        setDraggedDealId(null);
        setDragOverStage(null);
        stopAutoScroll();
        const target = e.target as HTMLElement;
        target.style.opacity = '1';
    };

    const handleDragOver = (e: React.DragEvent, stageId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverStage(stageId);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        // Only clear the over-state when the cursor truly leaves the column container
        // (not just moves onto a child element within it).
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverStage(null);
        }
    };

    const handleDrop = (e: React.DragEvent, targetStageId: string) => {
        e.preventDefault();
        setDragOverStage(null);
        stopAutoScroll();
        const dealId = e.dataTransfer.getData('dealId');
        const deal = deals.find(d => d.id === dealId);

        if (deal && deal.current_flow_state !== targetStageId) {
            onStageChange(deal, targetStageId);
        }
    };

    React.useEffect(() => stopAutoScroll, []);

    return (
        <div
            ref={scrollRef}
            onDragOver={handleBoardDragOver}
            className="flex gap-6 overflow-x-auto overflow-y-hidden pb-6 h-full pipeline-scrollbar"
        >
            {stages.map((stage) => {
                // Use current_flow_state as the authoritative source; fall back to stage name only
                // when current_flow_state is absent. The OR fallback caused deals to appear in
                // terminal (Won/Lost) columns because the legacy `stage` field matched stage.name.
                const stageDeals = deals.filter(d =>
                    d.current_flow_state
                        ? d.current_flow_state === stage.id
                        : d.stage === stage.name
                );
                const isOver = dragOverStage === stage.id;
                const accentColor = stage.color || '#94A3B8';

                return (
                    <div
                        key={stage.id}
                        className="w-80 flex-shrink-0 h-full flex flex-col gap-4"
                    >
                        {/* Stage Header — a non-scrolling flex item, so it stays put while
                            the drop zone below it scrolls independently. */}
                        <div className="flex-shrink-0 flex items-center justify-between px-2">
                            <h3
                                className="font-black text-slate-100 flex items-center gap-2 text-sm uppercase tracking-wider"
                                style={{ color: accentColor }}
                            >
                                {stage.name}
                                <span className="text-[10px] bg-slate-400/20 text-slate-500 px-2 py-0.5 rounded-full font-black">
                                    {stageDeals.length}
                                </span>
                                {stage.is_terminal && (
                                    <Lock size={11} className="text-slate-500" />
                                )}
                            </h3>
                            <span className="text-[10px] text-slate-500 font-black tracking-wider">
                                {formatters.formatCurrency(stageDeals.reduce((sum, d) => sum + d.value, 0))}
                            </span>
                        </div>

                        {/* Drop Zone — scrolls independently within the column's bounded
                            height so the stage header above never scrolls out of view.
                            min-h-0 overrides flex's default min-height:auto, which would
                            otherwise stop this from shrinking to fit and force the
                            overflow to leak out into the board instead of scrolling here. */}
                        <div
                            onDragOver={(e) => handleDragOver(e, stage.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, stage.id)}
                            className={`flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 rounded-2xl p-3 pipeline-scrollbar transition-all duration-200 ${isOver
                                ? 'bg-blue-600/10 ring-2 ring-blue-500/50 ring-dashed border-transparent'
                                : 'bg-slate-900/40 border border-slate-700/40 shadow-sm'
                                }`}
                            style={!isOver ? { borderTopColor: accentColor, borderTopWidth: '3px', borderTopStyle: 'solid' } : undefined}
                        >
                            {stageDeals.map((deal) => (
                                <div
                                    key={deal.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, deal)}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => onDealClick(deal)}
                                    className={`bg-slate-800 border-2 p-4 rounded-xl shadow-md transition-all cursor-grab active:cursor-grabbing group ${draggedDealId === deal.id
                                        ? 'border-blue-500/50 scale-95'
                                        : 'border-slate-700/40 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-900/20'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-sm text-slate-50 group-hover:text-blue-400 transition-colors truncate">
                                            {deal.name}
                                        </h4>
                                    </div>

                                    <p className="text-[11px] text-slate-500 mb-4 line-clamp-1 flex items-center gap-1">
                                        <TrendingUp size={10} className="text-slate-500" />
                                        {deal.company_name}
                                    </p>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-slate-500/30 flex items-center justify-center text-[8px] font-black overflow-hidden border border-slate-400/30">
                                                {deal.owner.avatar_url ? (
                                                    <img src={deal.owner.avatar_url} alt={deal.owner.full_name} />
                                                ) : (
                                                    deal.owner.full_name.charAt(0)
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-100">{formatters.formatCurrency(deal.value)}</span>
                                            </div>
                                        </div>
                                        <span className="text-[9px] text-slate-500 font-bold flex items-center gap-1 bg-slate-400/10 px-1.5 py-0.5 rounded">
                                            <Calendar size={10} className="text-slate-500" /> {deal.expected_close_date}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {/* Empty state hint */}
                            {stageDeals.length === 0 && !isOver && (
                                <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-400/30 rounded-xl">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Drop here</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
