import { describe, expect, it, vi } from 'vitest';

import type { Metadata } from '@/api/types';
import { AUTO_TASK_TITLE_MAX_LENGTH, createAutoTaskMetadataUpdater } from './taskMetadata';

function createBaseMetadata(): Metadata {
  return {
    path: '/repo/project',
    host: 'host',
    machineId: 'machine-1',
    homeDir: '/home/user',
    happyHomeDir: '/home/user/.happy',
    happyLibDir: '/repo/.happy/lib',
    happyToolsDir: '/repo/.happy/tools',
  };
}

describe('createAutoTaskMetadataUpdater', () => {
  it('sets auto task metadata from first user message', () => {
    const metadata = createBaseMetadata();
    let updated: Metadata | null = null;
    const session = {
      updateMetadata: (handler: (current: Metadata) => Metadata) => {
        updated = handler(metadata);
      }
    } as any;

    const updateTask = createAutoTaskMetadataUpdater({ getSession: () => session, initialMetadata: metadata });
    updateTask('Implement payment retry flow for webhook timeouts');

    expect(updated).not.toBeNull();
    const next = updated as unknown as Metadata;
    expect(next.task?.source).toBe('auto');
    expect(next.task?.title).toBe('Implement payment retry flow for webhook timeouts');
    expect(next.task?.id).toMatch(/^task-/);
  });

  it('truncates long auto task title to 72 chars', () => {
    const metadata = createBaseMetadata();
    let updated: Metadata | null = null;
    const session = {
      updateMetadata: (handler: (current: Metadata) => Metadata) => {
        updated = handler(metadata);
      }
    } as any;

    const updateTask = createAutoTaskMetadataUpdater({ getSession: () => session, initialMetadata: metadata });
    updateTask('x'.repeat(AUTO_TASK_TITLE_MAX_LENGTH + 20));

    expect(updated).not.toBeNull();
    const next = updated as unknown as Metadata;
    expect(next.task?.title.length).toBe(AUTO_TASK_TITLE_MAX_LENGTH);
  });

  it('does not override manual task metadata', () => {
    const metadata: Metadata = {
      ...createBaseMetadata(),
      task: {
        id: 'manual-task',
        title: 'Manual title',
        source: 'manual',
        updatedAt: Date.now(),
      }
    };
    const updateMetadata = vi.fn((handler: (current: Metadata) => Metadata) => {
      const next = handler(metadata);
      expect(next).toEqual(metadata);
    });

    const updateTask = createAutoTaskMetadataUpdater({ getSession: () => ({ updateMetadata } as any), initialMetadata: metadata });
    updateTask('Auto title should not apply');

    expect(updateMetadata).toHaveBeenCalledTimes(1);
  });

  it('runs only once for the first user message', () => {
    const metadata = createBaseMetadata();
    const updateMetadata = vi.fn((handler: (current: Metadata) => Metadata) => handler(metadata));
    const updateTask = createAutoTaskMetadataUpdater({ getSession: () => ({ updateMetadata } as any), initialMetadata: metadata });

    updateTask('First title');
    updateTask('Second title');

    expect(updateMetadata).toHaveBeenCalledTimes(1);
  });
});
