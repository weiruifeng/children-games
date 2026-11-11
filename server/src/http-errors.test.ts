import { describe, it, expect } from 'vitest';
import { HttpException } from '@nestjs/common';
import { httpFailure, failureDiagnostic } from './http-errors';
describe('HTTP failure diagnosis', () => {
  it('correlates unexpected failures without returning or logging credential text', () => {
    const error = Error('database password=private-secret');
    const failure = httpFailure(error, 'request-1');
    expect(failure.status).toBe(500);
    expect(failure.payload.requestId).toBe('request-1');
    expect(JSON.stringify(failure)).not.toContain('private-secret');
    const log = failureDiagnostic(error, 'request-1');
    expect(log.frames).toContain('http-errors.test.ts');
    expect(JSON.stringify(log)).not.toContain('private-secret');
  });
  it('keeps rate-limit recovery details and parser failures distinct', () => {
    const rate = httpFailure(
      new HttpException(
        { error: { code: 'RATE_LIMITED', message: 'wait', details: { retryAfter: 12 } } },
        429,
      ),
      'r',
    );
    expect(rate.retryAfter).toBe(12);
    expect(rate.status).toBe(429);
    expect(httpFailure({ status: 413 }, 'r').payload.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(httpFailure({ type: 'entity.parse.failed' }, 'r').status).toBe(400);
  });
});
