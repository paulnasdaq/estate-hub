// Shared error handling (mirrors core/exceptions.py). openapi-fetch returns
// errors as data rather than throwing; query/mutation functions rethrow them so
// TanStack Query can track error state. This helper normalizes whatever was
// thrown into a user-facing message.

// This backend's error envelope (core/exceptions.py): the message a domain error
// exposes lives at { error: { code, message, request_id } }.
type ApiErrorEnvelope = {
  error?: { message?: string };
};

// FastAPI's default error body: { "detail": "..." } or a validation array.
type ApiErrorBody = {
  detail?: string | { msg?: string }[];
};

export function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const { error: envelope } = error as ApiErrorEnvelope;
    if (envelope && typeof envelope.message === "string") return envelope.message;
    if ("detail" in error) {
      const { detail } = error as ApiErrorBody;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
    }
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
