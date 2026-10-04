import { APIError } from 'payload';
import type { ConsoleErrorCode } from '../codes.ts';

type ConsoleErrorData = Record<string, unknown> & { code: ConsoleErrorCode };

export class ConsoleError extends APIError<ConsoleErrorData> {
  readonly code: ConsoleErrorCode;

  constructor(code: ConsoleErrorCode, status: number, message: string, data?: Record<string, unknown>) {
    super(message, status, { code, ...data } as ConsoleErrorData, true);
    this.code = code;
  }
}
