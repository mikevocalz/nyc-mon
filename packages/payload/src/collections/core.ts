// The @acme/core seams these collections validate against (Law 5).
export {
  CareStateSchema,
  ConsentStatusSchema,
  EggRecordSchema,
  EpochMsSchema,
  IdSchema,
  MON_GENDERS,
  MIN_BIRTH_YEAR,
  MonInstanceSchema,
} from '@acme/core/schemas';
export { deriveMonGender, deriveMonInstanceId, deriveVoiceLineageId, isAllowedMonNicknameWrite, isConsentRequired } from '@acme/core/sim';
