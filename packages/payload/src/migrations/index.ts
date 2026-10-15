import * as migration_20261004_213700 from './20261004_213700';
import * as migration_20261007_202116_waitlist from './20261007_202116_waitlist';
import * as migration_20261008_181202_alexa_oauth from './20261008_181202_alexa_oauth';

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
    name: '20261008_181202_alexa_oauth'
  },
];
