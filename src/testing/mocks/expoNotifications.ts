/**
 * An in-memory stand-in for expo-notifications (Jest has no native module):
 * scheduled requests, permission state and tap listeners, with helpers to
 * inspect and drive them. Installed for every test in jest.setup.ts.
 */
type Request = { identifier: string; content: { title?: string; body?: string; data?: Record<string, unknown> }; trigger: unknown };
type Response = { notification: { request: Request } };

export const state = {
  scheduled: new Map<string, Request>(),
  permission: { granted: false, status: 'undetermined' as 'granted' | 'denied' | 'undetermined', canAskAgain: true },
  /** What requestPermissionsAsync answers. */
  answer: 'granted' as 'granted' | 'denied',
  requests: 0,
  channels: new Map<string, unknown>(),
  listeners: new Set<(r: Response) => void>(),
  lastResponse: null as Response | null,
};

export function __reset(): void {
  state.scheduled.clear();
  state.permission = { granted: false, status: 'undetermined', canAskAgain: true };
  state.answer = 'granted';
  state.requests = 0;
  state.channels.clear();
  state.listeners.clear();
  state.lastResponse = null;
}

/** Simulates the user tapping a scheduled notification. */
export function __tap(identifier: string): void {
  const request = state.scheduled.get(identifier);
  if (!request) throw new Error(`No scheduled notification ${identifier}`);
  const response = { notification: { request } };
  state.lastResponse = response;
  for (const l of state.listeners) l(response);
}

export const SchedulableTriggerInputTypes = { DATE: 'date' } as const;
export const AndroidImportance = { DEFAULT: 3 } as const;

export const setNotificationHandler = jest.fn();
export const setNotificationChannelAsync = jest.fn(async (id: string, channel: unknown) => {
  state.channels.set(id, channel);
  return channel;
});
export const getPermissionsAsync = jest.fn(async () => ({ ...state.permission }));
export const requestPermissionsAsync = jest.fn(async () => {
  state.requests++;
  state.permission = { granted: state.answer === 'granted', status: state.answer, canAskAgain: state.answer !== 'denied' };
  return { ...state.permission };
});
export const getAllScheduledNotificationsAsync = jest.fn(async () => [...state.scheduled.values()]);
export const scheduleNotificationAsync = jest.fn(async (request: Request) => {
  state.scheduled.set(request.identifier, request);
  return request.identifier;
});
export const cancelScheduledNotificationAsync = jest.fn(async (id: string) => {
  state.scheduled.delete(id);
});
export const getLastNotificationResponse = jest.fn(() => state.lastResponse);
export const addNotificationResponseReceivedListener = jest.fn((listener: (r: Response) => void) => {
  state.listeners.add(listener);
  return { remove: () => state.listeners.delete(listener) };
});
