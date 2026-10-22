import * as Device from 'expo-device';

import { apiBaseUrl } from '@/api/config';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  created_at: string;
};

export type AuthTokens = {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

/** A failed auth request; `status` is 0 when the backend couldn't be reached. */
export class AuthError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'AuthError';
  }
}

type ValidationIssue = { msg?: string };

function readableDetail(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    // FastAPI validation errors: [{ msg: 'Value error, Enter a valid email address', ... }]
    const first = (detail as ValidationIssue[])[0]?.msg ?? '';
    const cleaned = first.replace(/^Value error, /, '');
    if (cleaned.includes('at least 8')) return 'Use a password with at least 8 characters.';
    return cleaned || fallback;
  }
  return fallback;
}

async function request<T>(path: string, init: RequestInit, fallback: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
  } catch {
    throw new AuthError("Can't reach Resonance right now. Check your connection and try again.", 0);
  }
  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => ({}))) as { detail?: unknown };
  if (!response.ok) throw new AuthError(readableDetail(payload.detail, fallback), response.status);
  return payload as T;
}

const deviceLabel = () => [Device.manufacturer, Device.modelName].filter(Boolean).join(' ').slice(0, 80) || undefined;

export function signUp(name: string, email: string, password: string) {
  return request<AuthTokens>(
    '/api/v1/auth/signup',
    { method: 'POST', body: JSON.stringify({ name, email, password, device_label: deviceLabel() }) },
    "We couldn't create your account. Please try again.",
  );
}

export function signIn(email: string, password: string) {
  return request<AuthTokens>(
    '/api/v1/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password, device_label: deviceLabel() }) },
    "We couldn't sign you in. Please try again.",
  );
}

export function refreshTokens(refreshToken: string) {
  return request<AuthTokens>(
    '/api/v1/auth/refresh',
    { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) },
    'Your session has ended. Please sign in again.',
  );
}

export function fetchMe(accessToken: string) {
  return request<AuthUser>(
    '/api/v1/auth/me',
    { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } },
    'Please sign in.',
  );
}

export function signOutRemote(refreshToken: string) {
  return request<void>(
    '/api/v1/auth/logout',
    { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) },
    "We couldn't sign you out.",
  );
}
