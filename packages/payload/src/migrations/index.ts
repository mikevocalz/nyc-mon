import * as migration_20261004_213700 from './20261004_213700';
import * as migration_20261007_202116_waitlist from './20261007_202116_waitlist';
import * as migration_20261008_181202_alexa_oauth from './20261008_181202_alexa_oauth';
import * as migration_20261021_195853_mon_models from './20261021_195853_mon_models';
import * as migration_20261023_235809_mon_gender from './20261023_235809_mon_gender';
import * as migration_20261024_164500_companion_memory from './20261024_164500_companion_memory';
import * as migration_20261028_192132_mon_lingo from './20261028_192132_mon_lingo';
import * as migration_20261028_200000_mon_lingo_seed from './20261028_200000_mon_lingo_seed';
import * as migration_20261029_120000_mon_babble_seed from './20261029_120000_mon_babble_seed';

export const migrations = [
  {
    up: migration_20261004_213700.up,
    down: migration_20261004_213700.down,
    name: '20261004_213700',
  },
  {
    up: migration_20261007_202116_waitlist.up,
    down: migration_20261007_202116_waitlist.down,
    name: '20261007_202116_waitlist',
  },
  {
    up: migration_20261008_181202_alexa_oauth.up,
    down: migration_20261008_181202_alexa_oauth.down,
    name: '20261008_181202_alexa_oauth',
  },
  {
    up: migration_20261021_195853_mon_models.up,
    down: migration_20261021_195853_mon_models.down,
    name: '20261021_195853_mon_models',
  },
  {
    up: migration_20261023_235809_mon_gender.up,
    down: migration_20261023_235809_mon_gender.down,
    name: '20261023_235809_mon_gender',
  },
  {
    up: migration_20261024_164500_companion_memory.up,
    down: migration_20261024_164500_companion_memory.down,
    name: '20261024_164500_companion_memory',
  },
  {
    up: migration_20261028_192132_mon_lingo.up,
    down: migration_20261028_192132_mon_lingo.down,
    name: '20261028_192132_mon_lingo',
  },
  {
    up: migration_20261028_200000_mon_lingo_seed.up,
    down: migration_20261028_200000_mon_lingo_seed.down,
    name: '20261028_200000_mon_lingo_seed',
  },
  {
    up: migration_20261029_120000_mon_babble_seed.up,
    down: migration_20261029_120000_mon_babble_seed.down,
    name: '20261029_120000_mon_babble_seed',
  },
];
