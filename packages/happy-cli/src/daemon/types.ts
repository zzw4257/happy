/**
 * Daemon-specific types (not related to API/server communication)
 */

import { Metadata } from '@/api/types';
import { ChildProcess } from 'child_process';

/**
 * Session tracking for daemon
 */
export interface TrackedSession {
  startedBy: 'daemon' | string;
  happySessionId?: string;
  happySessionMetadataFromLocalWebhook?: Metadata;
  pid: number;
  /**
   * Hash of the observed process command line for PID reuse safety.
   * If present, we require this hash to match before SIGTERM by PID.
   */
  processCommandHash?: string;
  childProcess?: ChildProcess;
  error?: string;
  directoryCreated?: boolean;
  message?: string;
  /** tmux session identifier (format: session:window) */
  tmuxSessionId?: string;
  /**
   * Session adopted from on-disk marker after daemon restart.
   * These sessions are kill-protected unless PID safety checks pass.
   */
  reattachedFromDiskMarker?: boolean;
}
