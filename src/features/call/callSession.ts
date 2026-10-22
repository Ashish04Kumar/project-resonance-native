export type CallSessionMode = 'inactive' | 'active' | 'minimized';
export type CallLanguage = 'english' | 'hinglish';

let mode: CallSessionMode = 'inactive';
let startedAt: number | null = null;
let elapsedBeforeMinimize = 0;
let callLanguage: CallLanguage = 'english';
let backendCallId: string | null = null;
let callConsent = false;
const listeners = new Set<() => void>();

export function subscribeToCallSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCallSessionMode() {
  return mode;
}

export function getCallLanguage() { return callLanguage; }
export function setCallLanguage(language: CallLanguage) { callLanguage = language; }
export function getBackendCallId() { return backendCallId; }
export function setBackendCallId(callId: string | null) { backendCallId = callId; }
export function getCallConsent() { return callConsent; }
export function setCallConsent(consented: boolean) { callConsent = consented; }

export function getCallElapsedSeconds() {
  const runningSeconds = startedAt === null ? 0 : Math.floor((Date.now() - startedAt) / 1000);
  return elapsedBeforeMinimize + runningSeconds;
}

export function startCallSession() {
  elapsedBeforeMinimize = 0;
  backendCallId = null;
  callConsent = false;
  startedAt = Date.now();
  mode = 'active';
  publish();
}

export function resumeCallSession() {
  if (startedAt === null) startedAt = Date.now();
  mode = 'active';
  publish();
}

export function minimizeCallSession() {
  if (mode === 'active' && startedAt !== null) {
    elapsedBeforeMinimize += Math.floor((Date.now() - startedAt) / 1000);
    startedAt = null;
  }
  mode = 'minimized';
  publish();
}

export function endCallSession() {
  mode = 'inactive';
  startedAt = null;
  elapsedBeforeMinimize = 0;
  backendCallId = null;
  callConsent = false;
  publish();
}

function publish() {
  listeners.forEach((listener) => listener());
}
