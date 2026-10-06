import * as migration_20261004_213700 from './20261004_213700';

export const migrations = [
  {
    up: migration_20261004_213700.up,
    down: migration_20261004_213700.down,
    name: '20261004_213700'
  },
];
