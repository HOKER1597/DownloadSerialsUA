import { request } from './client';
import type { DownloadJob } from '../domain/jobs';

export const jobsApi = {
  jobs: () => request<DownloadJob[]>('/api/jobs'),
  start: (body: {
    catalog_id: string;
    episode_ids: string[];
    quality: string;
    output_dir: string;
    parallel_limit: number;
  }) => request<DownloadJob>('/api/jobs', { method: 'POST', body: JSON.stringify(body) }),
  cancel: (id: string) => request<DownloadJob>(`/api/jobs/${id}/cancel`, { method: 'POST' }),
  retry: (id: string) => request<DownloadJob>(`/api/jobs/${id}/retry`, { method: 'POST' }),
  deleteFile: (id: string, episodeId: string) =>
    request<DownloadJob>(`/api/jobs/${id}/delete-file`, {
      method: 'POST',
      body: JSON.stringify({ episode_id: episodeId }),
    }),
  deleteJob: (id: string) => request<{ deleted: boolean }>(`/api/jobs/${id}`, { method: 'DELETE' }),
  openPath: (id: string, kind: 'folder' | 'file', episodeId?: string) =>
    request<{ opened: boolean }>(`/api/jobs/${id}/open/${kind}`, {
      method: 'POST',
      body: JSON.stringify({ episode_id: episodeId || null }),
    }),
};
