import { findHappyProcessByPid } from './doctor';
import { hashProcessCommand } from './sessionRegistry';

// Keep this strict. False positives here may kill unrelated processes.
export const ALLOWED_HAPPY_SESSION_PROCESS_TYPES = new Set([
  'daemon-spawned-session',
  'user-session',
  'dev-daemon-spawned',
  'dev-session',
]);

export async function isPidSafeHappySessionProcess(params: {
  pid: number;
  expectedProcessCommandHash?: string;
}): Promise<boolean> {
  const processInfo = await findHappyProcessByPid(params.pid);
  if (!processInfo || !ALLOWED_HAPPY_SESSION_PROCESS_TYPES.has(processInfo.type)) {
    return false;
  }

  if (!params.expectedProcessCommandHash) {
    return true;
  }

  return hashProcessCommand(processInfo.command) === params.expectedProcessCommandHash;
}
