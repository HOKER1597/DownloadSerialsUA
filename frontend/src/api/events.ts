import { token } from './client';
import type { ScanState } from '../domain/catalog';
import type { DownloadJob } from '../domain/jobs';

export interface AppEvent {
  type: 'scan' | 'job';
  scan?: ScanState;
  job?: DownloadJob;
}

export function connectEvents(onEvent: (event: AppEvent) => void): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(
    `${protocol}//${window.location.host}/api/events?token=${encodeURIComponent(token)}`,
  );
  socket.onmessage = (message) => onEvent(JSON.parse(message.data));
  return socket;
}
