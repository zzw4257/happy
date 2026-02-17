import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/daemon/controlClient', () => ({
  isDaemonRunningCurrentlyInstalledHappyVersion: vi.fn(),
}));

vi.mock('@/utils/spawnHappyCLI', () => ({
  spawnHappyCLI: vi.fn(),
}));

vi.mock('@/ui/logger', () => ({
  logger: {
    debug: vi.fn(),
  },
}));

import { isDaemonRunningCurrentlyInstalledHappyVersion } from '@/daemon/controlClient';
import { spawnHappyCLI } from '@/utils/spawnHappyCLI';
import { ensureDaemonRunning, resolveDefaultAgent } from './daemonLifecycle';

describe('daemonLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolveDefaultAgent falls back to claude for invalid values', () => {
    expect(resolveDefaultAgent('claude')).toBe('claude');
    expect(resolveDefaultAgent('codex')).toBe('codex');
    expect(resolveDefaultAgent('gemini')).toBe('gemini');
    expect(resolveDefaultAgent('unknown')).toBe('claude');
    expect(resolveDefaultAgent(undefined)).toBe('claude');
  });

  it('ensureDaemonRunning does nothing when daemon already matches version', async () => {
    vi.mocked(isDaemonRunningCurrentlyInstalledHappyVersion).mockResolvedValue(true);

    await ensureDaemonRunning();

    expect(spawnHappyCLI).not.toHaveBeenCalled();
  });

  it('ensureDaemonRunning starts daemon when not running', async () => {
    vi.mocked(isDaemonRunningCurrentlyInstalledHappyVersion).mockResolvedValue(false);
    const unref = vi.fn();
    vi.mocked(spawnHappyCLI).mockReturnValue({ unref } as any);

    await ensureDaemonRunning();

    expect(spawnHappyCLI).toHaveBeenCalledWith(['daemon', 'start-sync'], expect.objectContaining({
      detached: true,
      stdio: 'ignore'
    }));
    expect(unref).toHaveBeenCalledTimes(1);
  });
});
