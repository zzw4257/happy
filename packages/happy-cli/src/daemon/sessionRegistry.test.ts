import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('sessionRegistry', () => {
  const originalHappyHomeDir = process.env.HAPPY_HOME_DIR;
  let happyHomeDir: string;

  beforeEach(() => {
    happyHomeDir = join(tmpdir(), `happy-cli-session-registry-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    process.env.HAPPY_HOME_DIR = happyHomeDir;
    vi.resetModules();
  });

  afterEach(() => {
    if (existsSync(happyHomeDir)) {
      rmSync(happyHomeDir, { recursive: true, force: true });
    }
    if (originalHappyHomeDir === undefined) {
      delete process.env.HAPPY_HOME_DIR;
    } else {
      process.env.HAPPY_HOME_DIR = originalHappyHomeDir;
    }
  });

  it('writes marker and preserves createdAt across updates', async () => {
    const { configuration } = await import('@/configuration');
    const { listSessionMarkers, writeSessionMarker } = await import('./sessionRegistry');

    await writeSessionMarker({
      pid: 12345,
      sessionId: 'sess-1',
      startedBy: 'terminal',
    });

    const markers1 = await listSessionMarkers();
    expect(markers1).toHaveLength(1);
    expect(markers1[0].pid).toBe(12345);
    expect(markers1[0].sessionId).toBe('sess-1');
    expect(markers1[0].happyHomeDir).toBe(configuration.happyHomeDir);
    expect(typeof markers1[0].createdAt).toBe('number');
    expect(typeof markers1[0].updatedAt).toBe('number');

    const createdAt = markers1[0].createdAt;
    const updatedAt = markers1[0].updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 2));

    await writeSessionMarker({
      pid: 12345,
      sessionId: 'sess-2',
      startedBy: 'daemon',
    });

    const markers2 = await listSessionMarkers();
    expect(markers2).toHaveLength(1);
    expect(markers2[0].createdAt).toBe(createdAt);
    expect(markers2[0].updatedAt).toBeGreaterThanOrEqual(updatedAt);
    expect(markers2[0].sessionId).toBe('sess-2');
  });

  it('ignores markers from another happyHomeDir and tolerates invalid JSON', async () => {
    const { configuration } = await import('@/configuration');
    const { listSessionMarkers } = await import('./sessionRegistry');

    const markersDir = join(configuration.happyHomeDir, 'tmp', 'daemon-sessions');
    mkdirSync(markersDir, { recursive: true });

    writeFileSync(
      join(markersDir, 'pid-111.json'),
      JSON.stringify({
        pid: 111,
        sessionId: 'x',
        happyHomeDir: '/another-home',
        createdAt: 1,
        updatedAt: 1,
      }, null, 2),
      'utf-8'
    );
    writeFileSync(join(markersDir, 'pid-222.json'), '{', 'utf-8');

    const markers = await listSessionMarkers();
    expect(markers).toEqual([]);
  });

  it('removeSessionMarker does not throw when marker is absent', async () => {
    const { removeSessionMarker } = await import('./sessionRegistry');
    await expect(removeSessionMarker(99999)).resolves.toBeUndefined();
  });

  it('writes expected marker payload to disk', async () => {
    const { configuration } = await import('@/configuration');
    const { writeSessionMarker } = await import('./sessionRegistry');

    await writeSessionMarker({
      pid: 54321,
      sessionId: 'sess-xyz',
      startedBy: 'daemon',
    });

    const filePath = join(configuration.happyHomeDir, 'tmp', 'daemon-sessions', 'pid-54321.json');
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    expect(parsed.pid).toBe(54321);
    expect(parsed.sessionId).toBe('sess-xyz');
    expect(parsed.startedBy).toBe('daemon');
    expect(parsed.happyHomeDir).toBe(configuration.happyHomeDir);
    expect(typeof parsed.createdAt).toBe('number');
    expect(typeof parsed.updatedAt).toBe('number');
  });
});
