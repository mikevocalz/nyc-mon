import { baseConfig } from '@acme/config/eslint/base.mjs';

export default [...baseConfig(), { ignores: ['public/**'] }];
