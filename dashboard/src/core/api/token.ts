// In-memory access token store.
//
// Keeping the token in a module variable (not localStorage) means it is not
// readable by injected scripts and is cleared on full page reload. When you
// wire up the backend `auth` endpoints, call `setAccessToken` after login and
// `clearAccessToken` on logout. If you later need the session to survive a
// reload, prefer a refresh-token flow over persisting the access token.

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}
