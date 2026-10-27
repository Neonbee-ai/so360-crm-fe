// TEMP-PROBE (remove)
import { it } from 'vitest';
import { writeSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
const w = (s: string) => writeSync(2, `[probe] ${s}\n`);
it('probe ds-real imports', async () => {
  const root = path.resolve(process.cwd(), '../../so360-shell-fe/packages/design-system/src/components');
  w(`cwd=${process.cwd()} root=${root} exists=${existsSync(root)}`);
  try { w(`files=${readdirSync(root).filter((f) => /^(PeopleSelector|Sparkline|TrendIndicator|StatusLegend|Modal|authToken|httpGetJson)\./.test(f)).join(',')}`); } catch (e) { w(`ls err ${e}`); }
  for (const n of ['Sparkline', 'TrendIndicator', 'StatusLegend', 'httpGetJson', 'authToken', 'PeopleSelector', 'Modal']) {
    w(`before ${n}`);
    try { await import(/* @vite-ignore */ `@ds-real/components/${n}`); w(`ok ${n}`); } catch (e) { w(`err ${n} ${String(e).slice(0, 200)}`); }
  }
  w('done');
}, 60000);
