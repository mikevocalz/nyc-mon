import { APIError } from 'payload';

/**
 * Stable codes for the integrity rules these collections enforce. Console and
 * `/v1` clients map `code` to copy; the message is for logs.
 */
export type RecordErrorCode =
  | 'APPEND_ONLY'
  | 'DELETE_FORBIDDEN'
  | 'IMMUTABLE_FIELD'
  | 'INVALID_RECORD'
  | 'INVALID_TRANSITION'
  | 'MON_ID_MISMATCH'
  | 'EGG_NOT_FOUND'
  | 'MON_NOT_FOUND';

const STATUS: Readonly<Record<RecordErrorCode, number>> = {
  APPEND_ONLY: 403,
  DELETE_FORBIDDEN: 403,
  IMMUTABLE_FIELD: 409,
  INVALID_RECORD: 400,
  INVALID_TRANSITION: 409,
  MON_ID_MISMATCH: 409,
  EGG_NOT_FOUND: 409,
  MON_NOT_FOUND: 409,
};

/** An `APIError` that carries a {@link RecordErrorCode} in `data.code`. */
export class RecordError extends APIError<{ code: RecordErrorCode }> {
  readonly code: RecordErrorCode;

  constructor(code: RecordErrorCode, message: string) {
    super(message, STATUS[code], { code }, true);
    this.code = code;
  }
}
