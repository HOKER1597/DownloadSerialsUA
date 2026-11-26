// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import type { Catalog, ScanState } from '../src/domain/catalog';
import type { DownloadJob } from '../src/domain/jobs';

const api = vi.hoisted(() => ({
  jobs: vi.fn(),
  getFolder: vi.fn(),
  saveFolder: vi.fn(),
  getScan: vi.fn(),
  scan: vi.fn(),
  start: vi.fn(),
  cancel: vi.fn(),
  retry: vi.fn(),
  deleteFile: vi.fn(),
  deleteJob: vi.fn(),
  openPath: vi.fn(),
  chooseFolder: vi.fn(),
}));

vi.mock('../src/api/index', () => ({ api, token: '', connectEvents: vi.fn() }));

const catalog: Catalog = {
  id: 'catalog',
  source_url: 'https://uakino.best/show.html',
  site: 'UAKINO',
  title: 'Детектив',
  season: 4,
  episodes: [
    {
      id: 'first',
      number: 1,
      season: 4,
      voice: 'Українська',
      source_url: 'https://ashdi.vip/1',
      variants: [
        {
          label: '960p',
          width: 1920,
          height: 960,
          bandwidth: 1_000_000,
          duration_seconds: 30,
          estimated_bytes: 100,
        },
      ],
    },
    {
      id: 'second',
      number: 2,
      season: 4,
      voice: 'Українська',
      source_url: 'https://ashdi.vip/2',
      variants: [
        {
          label: '1080p',
          width: 1920,
          height: 1080,
          bandwidth: 1_000_000,
          duration_seconds: 30,
          estimated_bytes: 120,
        },
      ],
    },
  ],
};

const scan: ScanState = {
  id: 'scan',
  status: 'complete',
  message: 'Готово',
  done: 2,
  total: 2,
  catalog,
  error: null,
};

function job(): DownloadJob {
  return {
    id: 'job',
    catalog_id: 'scan',
    title: 'Детектив',
    quality: 'w1920',
    resolution: 'Різна роздільність',
    output_dir: 'D:\Films',
    parallel_limit: 2,
    status: 'complete',
    estimated_bytes: 220,
    created_at: '2026-11-25T00:00:00Z',
    episodes: [
      {
        episode_id: 'first',
        number: 1,
        season: 4,
        voice: 'Українська',
        status: 'complete',
        percent: 100,
        bytes_written: 100,
        estimated_bytes: 100,
        speed_bytes: 0,
        phase: 'complete',
        speed: '',
        output_file: 'D:\Films\first.mp4',
        partial_file: null,
        error: null,
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  api.jobs.mockResolvedValue([]);
  api.getFolder.mockResolvedValue({ path: 'D:\Films' });
  api.saveFolder.mockResolvedValue({ path: 'D:\Films' });
  api.scan.mockResolvedValue(scan);
  api.start.mockResolvedValue(job());
  api.deleteJob.mockResolvedValue({ deleted: true });
});
afterEach(cleanup);

describe('complete user flows', () => {
  it('searches, selects the mixed-resolution tier and starts both episodes', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(
      screen.getByLabelText('Посилання на фільм, сезон або серію'),
      catalog.source_url,
    );
    await user.click(screen.getByRole('button', { name: 'Пошук' }));
    await waitFor(() => expect(screen.getByText('1920 × 960–1080 · ≈ 0,2 КБ')).toBeTruthy());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Завантажити' }).hasAttribute('disabled')).toBe(
        false,
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Завантажити' }));
    expect(api.start).toHaveBeenCalledWith({
      catalog_id: 'scan',
      episode_ids: ['first', 'second'],
      quality: 'w1920',
      output_dir: 'D:\Films',
      parallel_limit: 2,
    });
    expect(screen.getByText(/Завантаження розпочато/)).toBeTruthy();
  });

  it('confirms deletion and removes a completed job from history', async () => {
    const user = userEvent.setup();
    api.jobs.mockResolvedValue([job()]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Видалити Детектив з історії' })).toBeTruthy(),
    );
    await user.click(screen.getByRole('button', { name: 'Видалити Детектив з історії' }));
    await waitFor(() => expect(api.deleteJob).toHaveBeenCalledWith('job'));
    expect(screen.getByText('Поки що порожньо')).toBeTruthy();
    vi.restoreAllMocks();
  });
});
