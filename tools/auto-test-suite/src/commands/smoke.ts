import { Command } from 'commander';

import { runJourneys, selectJourneys } from './journey.ts';
import { g } from './root.ts';

/**
 * smokeCommand runs the core suite. explicit reports whether a global flag was
 * passed on the command line, so the smoke defaults never override the user.
 */
export function smokeCommand(explicit: (flag: 'headless' | 'uxGates') => boolean): Command {
  return new Command('smoke')
    .description('Run the core suite with --ux-gates fail, headless (unless those flags are passed explicitly)')
    .action(async () => {
      if (!explicit('headless')) g.headless = true;
      if (!explicit('uxGates')) g.uxGates = 'fail';
      const { selected, label } = selectJourneys([], { suite: 'core' });
      await runJourneys('smoke', selected, label);
    });
}
