import { createHash } from 'node:crypto';

import type { ApiSessionClient } from '@/api/apiSession';
import type { Metadata } from '@/api/types';

export const AUTO_TASK_TITLE_MAX_LENGTH = 72;

function normalizeTaskTitle(text: string): string | null {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }
  return normalized.length > AUTO_TASK_TITLE_MAX_LENGTH
    ? normalized.slice(0, AUTO_TASK_TITLE_MAX_LENGTH)
    : normalized;
}

function deriveAutoTaskId(metadata: Metadata): string {
  const machineId = metadata.machineId ?? 'unknown-machine';
  const path = metadata.path ?? 'unknown-path';
  const digest = createHash('sha1').update(`${machineId}:${path}`).digest('hex').slice(0, 12);
  return `task-${digest}`;
}

export function createAutoTaskMetadataUpdater(params: {
  getSession: () => ApiSessionClient;
  initialMetadata: Metadata;
}): (firstUserMessage: string) => void {
  let handled = false;

  return (firstUserMessage: string) => {
    if (handled) {
      return;
    }
    handled = true;

    const title = normalizeTaskTitle(firstUserMessage);
    if (!title) {
      return;
    }

    const fallbackTaskId = deriveAutoTaskId(params.initialMetadata);
    params.getSession().updateMetadata((currentMetadata) => {
      if (currentMetadata.task?.source === 'manual') {
        return currentMetadata;
      }

      const nextTaskId = currentMetadata.task?.id || fallbackTaskId;
      const unchanged =
        currentMetadata.task?.id === nextTaskId &&
        currentMetadata.task?.title === title &&
        currentMetadata.task?.source === 'auto';
      if (unchanged) {
        return currentMetadata;
      }

      return {
        ...currentMetadata,
        task: {
          id: nextTaskId,
          title,
          source: 'auto',
          updatedAt: Date.now(),
        }
      };
    });
  };
}
