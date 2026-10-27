import React, { useCallback, useEffect, useState } from 'react';
import { toast, Card, Button, Checkbox, TextField } from '@so360/design-system';
import { taskReminderService, TaskReminderSettings } from '../../../services/salesConfigService';
import { describeApiError } from '../../../utils/apiErrorMessage';

interface Props { canWrite: boolean }

/** Settings -> Task reminders. How long before the due time a task reminds its assignee. */
const TaskReminderSettingsTab: React.FC<Props> = ({ canWrite }) => {
    const [s, setS] = useState<TaskReminderSettings>({ enabled: true, default_offset_minutes: 30 });
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try { setS(await taskReminderService.get()); }
        catch (err) { toast.error(describeApiError(err, 'Could not load reminder settings.')); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const save = async () => {
        const n = s.default_offset_minutes;
        if (!Number.isInteger(n) || n < 0 || n > 10080) {
            toast.error('Enter whole minutes between 0 and 10080.');
            return;
        }
        setBusy(true);
        try {
            setS(await taskReminderService.put(s));
            toast.success('Reminder settings saved');
        } catch (err) { toast.error(describeApiError(err, 'Could not save the settings.')); }
        finally { setBusy(false); }
    };

    return (
        <div className="space-y-nb-4" data-testid="task-reminders-tab">
            <Card title="Task reminders" actions={canWrite ? <Button type="button" variant="primary" onClick={save} disabled={busy || loading}>Save</Button> : undefined}>
                <p className="text-xs text-fg-muted mb-nb-3">Assignees are notified before a task is due. A task can set its own reminder.</p>
                <div className="space-y-nb-3">
                    <Checkbox name="tr-enabled" label="Send task reminders" checked={s.enabled} disabled={!canWrite} onChange={(e) => setS({ ...s, enabled: e.target.checked })} />
                    <TextField name="tr-offset" type="number" label="Default reminder (minutes before due)" value={String(s.default_offset_minutes)} disabled={!canWrite || !s.enabled} onChange={(e) => setS({ ...s, default_offset_minutes: Number(e.target.value) })} />
                </div>
            </Card>
        </div>
    );
};

export default TaskReminderSettingsTab;
