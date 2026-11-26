import { request } from './client';

export const foldersApi = {
  getFolder: () => request<{ path: string }>('/api/folder'),
  saveFolder: (path: string) =>
    request<{ path: string }>('/api/folder', { method: 'PUT', body: JSON.stringify({ path }) }),
  chooseFolder: (path: string) =>
    request<{ path: string }>('/api/folder/select', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),
};
