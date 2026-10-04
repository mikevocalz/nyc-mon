// The @acme/core seams these collections validate against (Law 5).
//
// TODO(deps): `@acme/payload` lists `@acme/core` only in an uncommitted
// package.json change owned by another task. Until that lands, this one file
// reaches core by path so the collections compile on any checkout.
// Swap the specifiers below for `@acme/core/schemas` and `@acme/core/sim`
// then; nothing else imports core directly.
export {
  CareStateSchema,
  ConsentStatusSchema,
  EggRecordSchema,
  EpochMsSchema,
  IdSchema,
  MIN_BIRTH_YEAR,
  MonInstanceSchema,
} from '../../../core/schemas/index.ts';
export { isConsentRequired } from '../../../core/sim/consent.ts';
export { deriveMonInstanceId } from '../../../core/sim/hatch.ts';
