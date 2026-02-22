import { Machine, Session } from './storageTypes';

export type TaskSource = 'auto' | 'manual';

export type TaskTreeMachine = {
    machineId: string;
    machine: Machine | null;
    sessions: Session[];
    updatedAt: number;
};

export type TaskTreeTask = {
    id: string;
    title: string;
    source: TaskSource;
    updatedAt: number;
    sessionIds: string[];
    sessionCount: number;
    machines: TaskTreeMachine[];
};

function extractPathBasename(path: string | undefined): string {
    if (!path) {
        return 'Untitled Task';
    }
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || path;
}

function deriveTaskId(session: Session): string {
    const taskId = session.metadata?.task?.id;
    if (taskId && taskId.length > 0) {
        return taskId;
    }
    const machineId = session.metadata?.machineId || 'unknown-machine';
    const path = session.metadata?.path || 'unknown-path';
    return `derived:${machineId}:${path}`;
}

function deriveTaskTitle(session: Session): string {
    const metadataTitle = session.metadata?.task?.title?.trim();
    if (metadataTitle) {
        return metadataTitle;
    }
    const summaryTitle = session.metadata?.summary?.text?.trim();
    if (summaryTitle) {
        return summaryTitle;
    }
    return extractPathBasename(session.metadata?.path);
}

export function buildTaskTree(
    sessions: Record<string, Session>,
    machines: Record<string, Machine>
): TaskTreeTask[] {
    const taskMap = new Map<string, {
        id: string;
        title: string;
        source: TaskSource;
        updatedAt: number;
        sessions: Session[];
        machineMap: Map<string, TaskTreeMachine>;
    }>();

    for (const session of Object.values(sessions)) {
        const taskId = deriveTaskId(session);
        const title = deriveTaskTitle(session);
        const source: TaskSource = session.metadata?.task?.source === 'manual' ? 'manual' : 'auto';
        const taskUpdatedAt = session.metadata?.task?.updatedAt ?? session.updatedAt;
        const machineId = session.metadata?.machineId || 'unknown-machine';

        if (!taskMap.has(taskId)) {
            taskMap.set(taskId, {
                id: taskId,
                title,
                source,
                updatedAt: taskUpdatedAt,
                sessions: [],
                machineMap: new Map(),
            });
        }

        const task = taskMap.get(taskId)!;
        task.sessions.push(session);

        if (taskUpdatedAt > task.updatedAt) {
            task.updatedAt = taskUpdatedAt;
            task.title = title;
            task.source = source;
        }

        if (!task.machineMap.has(machineId)) {
            task.machineMap.set(machineId, {
                machineId,
                machine: machines[machineId] ?? null,
                sessions: [],
                updatedAt: session.updatedAt,
            });
        }

        const machineNode = task.machineMap.get(machineId)!;
        machineNode.sessions.push(session);
        if (session.updatedAt > machineNode.updatedAt) {
            machineNode.updatedAt = session.updatedAt;
        }
    }

    const tasks: TaskTreeTask[] = [];
    for (const task of taskMap.values()) {
        for (const machineNode of task.machineMap.values()) {
            machineNode.sessions.sort((a, b) => b.updatedAt - a.updatedAt);
        }

        const machinesList = Array.from(task.machineMap.values())
            .sort((a, b) => b.updatedAt - a.updatedAt);
        const taskSessions = task.sessions.sort((a, b) => b.updatedAt - a.updatedAt);

        tasks.push({
            id: task.id,
            title: task.title,
            source: task.source,
            updatedAt: task.updatedAt,
            sessionIds: taskSessions.map(session => session.id),
            sessionCount: taskSessions.length,
            machines: machinesList,
        });
    }

    return tasks.sort((a, b) => b.updatedAt - a.updatedAt);
}
