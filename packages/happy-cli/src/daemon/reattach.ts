import type { HappyProcessInfo } from './doctor';
import { ALLOWED_HAPPY_SESSION_PROCESS_TYPES } from './pidSafety';
import { hashProcessCommand, type DaemonSessionMarker } from './sessionRegistry';
import type { TrackedSession } from './types';

export function adoptSessionsFromMarkers(params: {
  markers: DaemonSessionMarker[];
  happyProcesses: HappyProcessInfo[];
  pidToTrackedSession: Map<number, TrackedSession>;
}): { adopted: number; eligible: number } {
  const pidToProcessType = new Map(params.happyProcesses.map((proc) => [proc.pid, proc.type] as const));
  const pidToCommandHash = new Map(params.happyProcesses.map((proc) => [proc.pid, hashProcessCommand(proc.command)] as const));

  let adopted = 0;
  let eligible = 0;

  for (const marker of params.markers) {
    const processType = pidToProcessType.get(marker.pid);
    if (!processType || !ALLOWED_HAPPY_SESSION_PROCESS_TYPES.has(processType)) {
      continue;
    }
    eligible++;

    if (!marker.processCommandHash) {
      continue;
    }

    const currentHash = pidToCommandHash.get(marker.pid);
    if (!currentHash || currentHash !== marker.processCommandHash) {
      continue;
    }

    if (params.pidToTrackedSession.has(marker.pid)) {
      continue;
    }

    params.pidToTrackedSession.set(marker.pid, {
      startedBy: marker.startedBy ?? 'reattached',
      happySessionId: marker.sessionId,
      happySessionMetadataFromLocalWebhook: marker.metadata,
      pid: marker.pid,
      processCommandHash: marker.processCommandHash,
      reattachedFromDiskMarker: true,
    });
    adopted++;
  }

  return { adopted, eligible };
}
