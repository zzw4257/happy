import { describe, expect, it } from 'vitest';

import type { Machine, Session } from './storageTypes';
import { buildTaskTree } from './taskTree';

function createSession(overrides: Partial<Session>): Session {
    return {
        id: overrides.id ?? 'session-1',
        seq: overrides.seq ?? 1,
        createdAt: overrides.createdAt ?? 1,
        updatedAt: overrides.updatedAt ?? 1,
        active: overrides.active ?? false,
        activeAt: overrides.activeAt ?? 1,
        metadata: overrides.metadata ?? {
            path: '/repo/a',
            host: 'host-1',
            machineId: 'machine-1',
        },
        metadataVersion: overrides.metadataVersion ?? 1,
        agentState: overrides.agentState ?? null,
        agentStateVersion: overrides.agentStateVersion ?? 1,
        thinking: overrides.thinking ?? false,
        thinkingAt: overrides.thinkingAt ?? 0,
        presence: overrides.presence ?? 0,
    };
}

function createMachine(overrides: Partial<Machine>): Machine {
    return {
        id: overrides.id ?? 'machine-1',
        seq: overrides.seq ?? 1,
        createdAt: overrides.createdAt ?? 1,
        updatedAt: overrides.updatedAt ?? 1,
        active: overrides.active ?? true,
        activeAt: overrides.activeAt ?? 1,
        metadata: overrides.metadata ?? {
            host: 'host-1',
            platform: 'darwin',
            happyCliVersion: '1.0.0',
            happyHomeDir: '/home/user/.happy',
            homeDir: '/home/user',
        },
        metadataVersion: overrides.metadataVersion ?? 1,
        daemonState: overrides.daemonState ?? null,
        daemonStateVersion: overrides.daemonStateVersion ?? 1,
    };
}

describe('buildTaskTree', () => {
    it('derives grouping by machineId + path when task metadata is missing', () => {
        const sessionA = createSession({
            id: 's1',
            metadata: { path: '/repo/a', host: 'h', machineId: 'm1' },
            updatedAt: 10,
        });
        const sessionB = createSession({
            id: 's2',
            metadata: { path: '/repo/a', host: 'h', machineId: 'm1' },
            updatedAt: 20,
        });

        const tasks = buildTaskTree({ s1: sessionA, s2: sessionB }, { m1: createMachine({ id: 'm1' }) });
        expect(tasks).toHaveLength(1);
        expect(tasks[0].sessionCount).toBe(2);
        expect(tasks[0].id).toBe('derived:m1:/repo/a');
    });

    it('merges sessions by explicit task.id and keeps machine sub-groups', () => {
        const sessionA = createSession({
            id: 's1',
            metadata: {
                path: '/repo/a',
                host: 'h1',
                machineId: 'm1',
                task: { id: 'task-x', title: 'Task X', source: 'auto', updatedAt: 100 },
            },
            updatedAt: 100,
        });
        const sessionB = createSession({
            id: 's2',
            metadata: {
                path: '/repo/b',
                host: 'h2',
                machineId: 'm2',
                task: { id: 'task-x', title: 'Task X', source: 'auto', updatedAt: 120 },
            },
            updatedAt: 120,
        });

        const tasks = buildTaskTree(
            { s1: sessionA, s2: sessionB },
            {
                m1: createMachine({ id: 'm1' }),
                m2: createMachine({ id: 'm2' }),
            }
        );

        expect(tasks).toHaveLength(1);
        expect(tasks[0].id).toBe('task-x');
        expect(tasks[0].machines).toHaveLength(2);
        expect(tasks[0].sessionCount).toBe(2);
    });

    it('uses latest manual title when task source is manual', () => {
        const autoSession = createSession({
            id: 's1',
            metadata: {
                path: '/repo/a',
                host: 'h1',
                machineId: 'm1',
                task: { id: 'task-x', title: 'Auto Name', source: 'auto', updatedAt: 100 },
            },
            updatedAt: 100,
        });
        const manualSession = createSession({
            id: 's2',
            metadata: {
                path: '/repo/a',
                host: 'h1',
                machineId: 'm1',
                task: { id: 'task-x', title: 'Manual Name', source: 'manual', updatedAt: 200 },
            },
            updatedAt: 200,
        });

        const tasks = buildTaskTree({ s1: autoSession, s2: manualSession }, { m1: createMachine({ id: 'm1' }) });
        expect(tasks).toHaveLength(1);
        expect(tasks[0].title).toBe('Manual Name');
        expect(tasks[0].source).toBe('manual');
    });
});
