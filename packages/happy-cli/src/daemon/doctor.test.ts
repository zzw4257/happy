import { describe, expect, it } from 'vitest';

import { classifyHappyProcess } from './doctor';

describe('classifyHappyProcess', () => {
  it('classifies daemon-spawned sessions', () => {
    const classified = classifyHappyProcess({
      pid: 123,
      name: 'node',
      cmd: 'node /app/dist/index.mjs codex --started-by daemon',
    });

    expect(classified).not.toBeNull();
    expect(classified?.type).toBe('daemon-spawned-session');
  });

  it('classifies user sessions', () => {
    const classified = classifyHappyProcess({
      pid: 123,
      name: 'node',
      cmd: 'node /app/dist/index.mjs',
    });

    expect(classified).not.toBeNull();
    expect(classified?.type).toBe('user-session');
  });

  it('ignores unrelated processes', () => {
    const classified = classifyHappyProcess({
      pid: 123,
      name: 'python',
      cmd: 'python script.py',
    });

    expect(classified).toBeNull();
  });
});
