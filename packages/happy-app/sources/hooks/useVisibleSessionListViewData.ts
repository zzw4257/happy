import * as React from 'react';
import { SessionListViewItem, useSessionListViewData, useSetting } from '@/sync/storage';

export function useVisibleSessionListViewData(): SessionListViewItem[] | null {
    const data = useSessionListViewData();
    const hideInactiveSessions = useSetting('hideInactiveSessions');

    return React.useMemo(() => {
        if (!data) {
            return data;
        }
        if (!hideInactiveSessions) {
            return data;
        }

        const filtered: SessionListViewItem[] = [];
        let pendingGroups: SessionListViewItem[] = [];

        for (const item of data) {
            if (item.type === 'project-group' || item.type === 'task-group' || item.type === 'task-machine-group' || item.type === 'header') {
                pendingGroups.push(item);
                continue;
            }

            if (item.type === 'session') {
                if (item.session.active) {
                    if (pendingGroups.length > 0) {
                        filtered.push(...pendingGroups);
                        pendingGroups = [];
                    }
                    filtered.push(item);
                }
                continue;
            }

            pendingGroups = [];

            if (item.type === 'active-sessions') {
                filtered.push(item);
            }
        }

        return filtered;
    }, [data, hideInactiveSessions]);
}
