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
      console.error(`\n[stall-watchdog] no test file finished for ${Math.round(STALL_MS / 1000)}s. Still running:\n${stuck.join('\n') || '  (none reported running; files collected: ' + this.files.size + ')'}\n`);
      process.exit(1);
    }, 15000);
    this.timer.unref();
  }

  private files = new Map<string, string>();

  private names = new Map<string, string>();
  private reported = new Set<string>();

  onCollected(files: any[] = []) {
    const walk = (t: any, prefix: string) => {
      this.names.set(t.id, `${prefix}${t.name}`);
      for (const c of t.tasks || []) walk(c, `${prefix}${t.name} > `);
    };
    for (const f of files) {
      this.files.set(f.id, f.filepath);
      for (const c of f.tasks || []) walk(c, `${String(f.filepath).split('/src/').pop()} :: `);
    }
  }

  onTaskUpdate(packs: Array<[string, { state?: string } | undefined]> = []) {
    for (const [id, result] of packs) {
      if (result?.state === 'fail' && !this.reported.has(id) && this.names.has(id)) {
        this.reported.add(id);
        const msg = String(((result as any).errors || [])[0]?.message || '').replace(/\s+/g, ' ').slice(0, 260);
        // eslint-disable-next-line no-console
        console.error(`[fail] ${this.names.get(id)} => ${msg}`);
      }
      const file = this.files.get(id);
      if (!file) continue;
      if (result?.state === 'run') {
        if (!this.running.has(file)) this.running.set(file, Date.now());
        this.lastProgress = Date.now();
      } else if (result?.state === 'pass' || result?.state === 'fail' || result?.state === 'skip') {
        this.running.delete(file);
        this.lastProgress = Date.now();
      }
    }
  }

  onTestRunEnd() {
    if (this.timer) clearInterval(this.timer);
  }
}
