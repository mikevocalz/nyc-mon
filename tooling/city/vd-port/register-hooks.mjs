// node --import ./tooling/city/vd-port/register-hooks.mjs tooling/city/bake-vd-storefronts.mjs
import { register } from 'node:module';

register('./storefront-hooks.mjs', import.meta.url);
