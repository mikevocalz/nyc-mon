// The @acme/core seams these collections validate against (Law 5).
export {
  CareStateSchema,
  ConsentStatusSchema,
  EggRecordSchema,
  EpochMsSchema,
  IdSchema,
  MIN_BIRTH_YEAR,
  MonInstanceSchema,
} from '@acme/core/schemas';
export { deriveMonInstanceId, isConsentRequired } from '@acme/core/sim';
