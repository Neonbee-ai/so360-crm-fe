/**
 * CI guard: a test file stuck in a synchronous / microtask-starved loop blocks
 * its worker, and per-test timeouts (timer based) can never fire. The main
 * process stays responsive, so it watches progress: if no test module has
 * finished for STALL_MS it names the modules still running and exits non-zero
 * instead of letting the job hang until the runner kills it.
 */
declare const process: any;

const STALL_MS = Number(process.env.VITEST_STALL_MS || 8 * 60 * 1000);

export default class StallWatchdogReporter {
  private running = new Map<string, number>();
  private lastProgress = Date.now();
  private timer: any | undefined;

  onInit() {
    this.timer = setInterval(() => {
      if (Date.now() - this.lastProgress < STALL_MS) return;
      const stuck = [...this.running.entries()].map(([id, t]) => `  - ${id} (running ${Math.round((Date.now() - t) / 1000)}s)`);
      // eslint-disable-next-line no-console
      console.error(`\n[stall-watchdog] no test file finished for ${Math.round(STALL_MS / 1000)}s. Still running:\n${stuck.join('\n') || '  (none started)'}\n`);
      process.exit(1);
    }, 15000);
    this.timer.unref();
  }

  onTestModuleStart(m: { moduleId: string }) {
    this.running.set(m.moduleId, Date.now());
    this.lastProgress = Date.now();
  }

  onTestModuleEnd(m: { moduleId: string }) {
    this.running.delete(m.moduleId);
    this.lastProgress = Date.now();
  }

  onTestRunEnd() {
    if (this.timer) clearInterval(this.timer);
  }
}
