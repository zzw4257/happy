import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as z from 'zod';

import type { Metadata } from '@/api/types';
import { configuration } from '@/configuration';
import { logger } from '@/ui/logger';

const DaemonSessionMarkerSchema = z.object({
  pid: z.number().int().positive(),
  sessionId: z.string(),
  happyHomeDir: z.string(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  startedBy: z.enum(['daemon', 'terminal']).optional(),
  processCommandHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  metadata: z.any().optional(),
});

export type DaemonSessionMarker = z.infer<typeof DaemonSessionMarkerSchema>;

function daemonSessionsDir(): string {
  return join(configuration.happyHomeDir, 'tmp', 'daemon-sessions');
}

async function ensureMarkerDir(): Promise<void> {
  await mkdir(daemonSessionsDir(), { recursive: true });
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const tmpPath = `${path}.tmp`;
  try {
    await writeFile(tmpPath, JSON.stringify(value, null, 2), 'utf-8');
    try {
      await rename(tmpPath, path);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      // On Windows, rename may fail if the destination exists.
      if (err.code === 'EEXIST' || err.code === 'EPERM') {
        try {
          await unlink(path);
        } catch {
          // noop
        }
        await rename(tmpPath, path);
        return;
      }
      throw error;
    }
  } catch (error) {
    try {
      await unlink(tmpPath);
    } catch {
      // noop
    }
    throw error;
  }
}

export function hashProcessCommand(command: string): string {
  return createHash('sha256').update(command).digest('hex');
}

export async function writeSessionMarker(input: {
  pid: number;
  sessionId: string;
  startedBy?: 'daemon' | 'terminal';
  metadata?: Metadata;
  processCommandHash?: string;
  createdAt?: number;
  updatedAt?: number;
}): Promise<void> {
  await ensureMarkerDir();
  const now = Date.now();
  const filePath = join(daemonSessionsDir(), `pid-${input.pid}.json`);

  let createdAtFromDisk: number | undefined;
  try {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = DaemonSessionMarkerSchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      createdAtFromDisk = parsed.data.createdAt;
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      logger.debug(`[sessionRegistry] Failed to read existing marker for PID ${input.pid}`, error);
    }
  }

  const payload = DaemonSessionMarkerSchema.parse({
    ...input,
    happyHomeDir: configuration.happyHomeDir,
    createdAt: input.createdAt ?? createdAtFromDisk ?? now,
    updatedAt: input.updatedAt ?? now,
  });

  await writeJsonAtomic(filePath, payload);
}

export async function removeSessionMarker(pid: number): Promise<void> {
  const filePath = join(daemonSessionsDir(), `pid-${pid}.json`);
  try {
    await unlink(filePath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      logger.debug(`[sessionRegistry] Failed to remove marker for PID ${pid}`, error);
    }
  }
}

export async function listSessionMarkers(): Promise<DaemonSessionMarker[]> {
  await ensureMarkerDir();

  const files = await readdir(daemonSessionsDir());
  const markers: DaemonSessionMarker[] = [];

  for (const fileName of files) {
    if (!fileName.startsWith('pid-') || !fileName.endsWith('.json')) {
      continue;
    }

    const filePath = join(daemonSessionsDir(), fileName);
    try {
      const raw = await readFile(filePath, 'utf-8');
      const parsed = DaemonSessionMarkerSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        logger.debug(`[sessionRegistry] Invalid marker file ${fileName}`, parsed.error);
        continue;
      }
      if (parsed.data.happyHomeDir !== configuration.happyHomeDir) {
        continue;
      }
      markers.push(parsed.data);
    } catch (error) {
      logger.debug(`[sessionRegistry] Failed reading marker ${fileName}`, error);
    }
  }

  return markers;
}
