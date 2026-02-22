import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./doctor', () => ({
  findHappyProcessByPid: vi.fn(),
}));

import { findHappyProcessByPid } from './doctor';
import { isPidSafeHappySessionProcess } from './pidSafety';
import { hashProcessCommand } from './sessionRegistry';

describe('isPidSafeHappySessionProcess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true for allowed process type without expected hash', async () => {
    vi.mocked(findHappyProcessByPid).mockResolvedValue({
      pid: 1,
      command: 'node dist/index.mjs codex --started-by daemon',
      type: 'daemon-spawned-session',
    });

    await expect(isPidSafeHappySessionProcess({ pid: 1 })).resolves.toBe(true);
  });

  it('returns false when hash does not match', async () => {
    vi.mocked(findHappyProcessByPid).mockResolvedValue({
      pid: 1,
      command: 'node dist/index.mjs codex --started-by daemon',
      type: 'daemon-spawned-session',
    });

    await expect(isPidSafeHappySessionProcess({
      pid: 1,
      expectedProcessCommandHash: hashProcessCommand('different command'),
    })).resolves.toBe(false);
  });
});
