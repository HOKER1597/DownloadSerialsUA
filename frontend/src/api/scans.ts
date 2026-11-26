import { request } from './client';
import type { ScanState } from '../domain/catalog';

export const scansApi = {
  scan: (url: string) =>
    request<ScanState>('/api/scans', { method: 'POST', body: JSON.stringify({ url }) }),
  getScan: (id: string) => request<ScanState>(`/api/scans/${id}`),
};
