import { HttpException } from '@nestjs/common';
import { ZodError } from 'zod';
import { errorResponseSchema } from '@children-games/shared';

export function httpFailure(error: unknown, requestId: string) {
  const metadata = typeof error === 'object' && error !== null ? error : {};
  const status =
    error instanceof ZodError
      ? 400
      : error instanceof HttpException
        ? error.getStatus()
        : 'status' in metadata && metadata.status === 413
          ? 413
          : 'type' in metadata && metadata.type === 'entity.parse.failed'
            ? 400
            : 500;
  const result =
    error instanceof HttpException ? errorResponseSchema.safeParse(error.getResponse()) : null;
  const fallback = {
    code:
      status === 413
        ? 'PAYLOAD_TOO_LARGE'
        : status === 400
          ? 'INVALID_INPUT'
          : 'SERVICE_UNAVAILABLE',
    message: status === 413 ? '提交内容太大' : status === 400 ? '输入格式不正确' : '服务暂不可用',
  };
  const payload = { error: result?.success ? result.data.error : fallback, requestId };
  const details = 'details' in payload.error ? payload.error.details : undefined;
  const retryAfter =
    typeof details === 'object' &&
    details !== null &&
    'retryAfter' in details &&
    typeof details.retryAfter === 'number'
      ? details.retryAfter
      : 60;
  return { status, payload, retryAfter };
}

/** Keep stack frames for diagnosis without logging exception text, SQL values or request bodies. */
export function failureDiagnostic(error: unknown, requestId: string) {
  return {
    requestId,
    kind: error instanceof Error ? error.name : 'UnknownError',
    frames:
      error instanceof Error
        ? error.stack
            ?.split('\n')
            .slice(1)
            .filter((line) => /^\s+at /.test(line))
            .join('\n')
        : undefined,
  };
}
