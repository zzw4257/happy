import { isDaemonRunningCurrentlyInstalledHappyVersion } from '@/daemon/controlClient';
import { spawnHappyCLI } from '@/utils/spawnHappyCLI';
import { logger } from '@/ui/logger';

export type DefaultAgent = 'claude' | 'codex' | 'gemini';

export function resolveDefaultAgent(value: string | undefined): DefaultAgent {
  if (value === 'codex' || value === 'gemini' || value === 'claude') {
    return value;
  }
  return 'claude';
}

export async function ensureDaemonRunning(): Promise<void> {
  logger.debug('Ensuring Happy background service is running & matches our version...');
  const running = await isDaemonRunningCurrentlyInstalledHappyVersion();
  if (running) {
    return;
  }

  logger.debug('Starting Happy background service...');
  const daemonProcess = spawnHappyCLI(['daemon', 'start-sync'], {
    detached: true,
    stdio: 'ignore',
    env: process.env
  });
  daemonProcess.unref();

  // Give daemon a moment to write pid/port state.
  await new Promise(resolve => setTimeout(resolve, 200));
}
