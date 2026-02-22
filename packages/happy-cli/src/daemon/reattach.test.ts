import { describe, expect, it } from 'vitest';

import { adoptSessionsFromMarkers } from './reattach';
import { hashProcessCommand, type DaemonSessionMarker } from './sessionRegistry';
import type { HappyProcessInfo } from './doctor';
import type { TrackedSession } from './types';

function marker(overrides: Partial<DaemonSessionMarker>): DaemonSessionMarker {
  return {
    pid: 100,
    sessionId: 'session-1',
    happyHomeDir: '/tmp/.happy',
    createdAt: 1,
    updatedAt: 1,
    startedBy: 'terminal',
    processCommandHash: hashProcessCommand('node dist/index.mjs --started-by daemon'),
    metadata: undefined,
    ...overrides,
  };
}

function processInfo(overrides: Partial<HappyProcessInfo>): HappyProcessInfo {
  return {
    pid: 100,
    type: 'daemon-spawned-session',
    command: 'node dist/index.mjs --started-by daemon',
    ...overrides,
  };
}

describe('adoptSessionsFromMarkers', () => {
  it('adopts marker when process type and hash match', () => {
    const pidToTrackedSession = new Map<number, TrackedSession>();
    const result = adoptSessionsFromMarkers({
      markers: [marker({})],
      happyProcesses: [processInfo({})],
      pidToTrackedSession,
    });

    expect(result.adopted).toBe(1);
    expect(result.eligible).toBe(1);
    expect(pidToTrackedSession.get(100)?.happySessionId).toBe('session-1');
  });

  it('refuses adoption on command hash mismatch', () => {
    const pidToTrackedSession = new Map<number, TrackedSession>();
    const result = adoptSessionsFromMarkers({
      markers: [marker({ processCommandHash: hashProcessCommand('other command') })],
      happyProcesses: [processInfo({})],
      pidToTrackedSession,
    });

    expect(result.adopted).toBe(0);
    expect(result.eligible).toBe(1);
    expect(pidToTrackedSession.size).toBe(0);
  });

  it('refuses adoption for unsupported process type', () => {
    const pidToTrackedSession = new Map<number, TrackedSession>();
    const result = adoptSessionsFromMarkers({
      markers: [marker({})],
      happyProcesses: [processInfo({ type: 'daemon' })],
      pidToTrackedSession,
    });

    expect(result.adopted).toBe(0);
    expect(result.eligible).toBe(0);
    expect(pidToTrackedSession.size).toBe(0);
  });
});
