import type { Profile } from '@children-games/shared';

export interface ProfileWriter {
  writeProfileRecovery: (slot: number, profile: Profile) => void;
  saveProfile: (slot: number, profile: Profile) => Promise<void>;
}

/** Captures the slot and immutable profile when queued, before a UI session can change. */
export class SaveCoordinator {
  readonly queue = { current: Promise.resolve() };
  private accepting = true;
  constructor(private readonly writer: ProfileWriter) {}
  enqueue(slot: number, profile: Profile): { saved: Promise<void>; recoveryError?: unknown } {
    if (!this.accepting) throw Error('花园会话已关闭');
    const frozen = structuredClone(profile);
    let recoveryError: unknown;
    try {
      this.writer.writeProfileRecovery(slot, frozen);
    } catch (error) {
      recoveryError = error;
    }
    const saved = this.queue.current
      .catch(() => {
        /* A later explicit save may recover an earlier failure. */
      })
      .then(() => this.writer.saveProfile(slot, frozen));
    this.queue.current = saved;
    return { saved, recoveryError };
  }
  async finish() {
    this.accepting = false;
    await this.queue.current;
  }
}
