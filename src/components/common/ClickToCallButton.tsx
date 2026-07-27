import React from 'react';
import { Phone } from 'lucide-react';
import { eventBus } from '@so360/event-bus';
import { useShellBridge } from '@so360/shell-context';

/** Feature flag gating click-to-call across the platform (owned by Inbox voice calling). */
export const VOICE_CALLING_FLAG = 'submodule:inbox:voice_calling';

/** Event-bus topic the shell softphone widget subscribes to. */
export const VOICE_CALL_REQUEST_TOPIC = 'VOICE_CALL_REQUEST';

export type ClickToCallEntityType = 'contact' | 'lead' | 'company' | 'deal';

interface ClickToCallButtonProps {
    /** Phone number to dial — renders nothing when empty/absent. */
    number?: string | null;
    entityType: ClickToCallEntityType;
    entityId?: string;
    /** Display name shown in the softphone widget. */
    name?: string;
    /** Lucide icon size, matches sibling inline action icons (default 14). */
    size?: number;
    className?: string;
}

/**
 * Small inline action button that asks the shell-mounted softphone to dial a
 * number by publishing `VOICE_CALL_REQUEST` on the shared event bus.
 *
 * Gating (fail-open, mirroring FlagGuard/ModuleGuard in App.tsx): the button
 * renders unless the shell bridge explicitly reports the voice-calling flag as
 * hidden/disabled/locked, or reports the Inbox module as disabled. When the
 * bridge (or a capability on it) is unavailable, we render.
 */
export const ClickToCallButton: React.FC<ClickToCallButtonProps> = ({
    number,
    entityType,
    entityId,
    name,
    size = 14,
    className = '',
}) => {
    const shell = useShellBridge();
    const trimmedNumber = (number ?? '').trim();

    // Fail-open feature gate — same pattern as FlagGuard in App.tsx.
    const featureState = shell?.getFeatureState ? shell.getFeatureState(VOICE_CALLING_FLAG) : 'enabled';
    // Hide when the Inbox module (softphone owner) is disabled — same pattern as ModuleGuard.
    const inboxEnabled = shell?.isModuleEnabled ? shell.isModuleEnabled('inbox') : true;

    if (
        !trimmedNumber ||
        !inboxEnabled ||
        featureState === 'hidden' ||
        featureState === 'disabled' ||
        featureState === 'locked'
    ) {
        return null;
    }

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        // Safe inside clickable rows / next to links — don't trigger row navigation.
        e.stopPropagation();
        e.preventDefault();
        eventBus.publish(VOICE_CALL_REQUEST_TOPIC, {
            number: trimmedNumber,
            entityType,
            entityId,
            name,
        });
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-label={`Call ${trimmedNumber}`}
            title={`Call ${trimmedNumber}`}
            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800 text-emerald-400 hover:text-emerald-300 hover:bg-slate-700 border border-slate-700/50 transition-colors ${className}`}
        >
            <Phone size={size} />
        </button>
    );
};

export default ClickToCallButton;
