/**
 * Failures from the data layer. Tools map each one to plain-language text;
 * none of these messages reaches a customer.
 */
export class DataError extends Error {
  override readonly name: string = 'DataError';
}

/** `/v1` refused the account under the 18+ rule (ADR 0015 §1). */
export class AdultRequiredError extends DataError {
  override readonly name = 'AdultRequiredError';
}

/** `/v1` has no such Mon for this Caller. */
export class NotFoundError extends DataError {
  override readonly name = 'NotFoundError';
}

/**
 * A write was sent but no answer came back (timeout or dropped connection),
 * so `/v1` may or may not have applied it. Re-read before telling anyone.
 */
export class WriteUnconfirmedError extends DataError {
  override readonly name = 'WriteUnconfirmedError';
}

/** `/v1` is down, slow, misconfigured or answered something unparseable. */
export class UpstreamError extends DataError {
  override readonly name = 'UpstreamError';
}
