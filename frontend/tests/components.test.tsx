// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchForm } from '../src/features/search/SearchForm';
import { CatalogView } from '../src/features/catalog/CatalogView';
import { DownloadSettings } from '../src/features/catalog/DownloadSettings';
import { buildQualityOptions } from '../src/features/catalog/quality';
import { JobEpisodeRow } from '../src/features/downloads/JobEpisodeRow';
import { JobList } from '../src/features/downloads/JobList';
import type { Catalog } from '../src/domain/catalog';
import type { DownloadJob } from '../src/domain/jobs';

afterEach(cleanup);

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

function job(id: string, title: string, status: DownloadJob['status']): DownloadJob {
  return {
    id,
    catalog_id: 'catalog',
    title,
    quality: 'w1920',
    resolution: 'Різна роздільність',
    output_dir: 'D:\Films',
    parallel_limit: 1,
    status,
    estimated_bytes: 100,
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
        output_file: 'D:\Films\one.mp4',
        partial_file: null,
        error: null,
      },
    ],
  };
}

describe('user controls', () => {
  it('submits a source link and blocks repeated clicks while scanning', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn((event: React.FormEvent) => event.preventDefault());
    const view = render(
      <SearchForm
        url="https://uakino.best/show.html"
        onUrlChange={vi.fn()}
        onSearch={onSearch}
        busy={false}
        scanning={false}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Пошук' }));
    expect(onSearch).toHaveBeenCalledOnce();
    view.rerender(
      <SearchForm
        url="https://uakino.best/show.html"
        onUrlChange={vi.fn()}
        onSearch={onSearch}
        busy={false}
        scanning
      />,
    );
    expect(screen.getByRole('button', { name: 'Пошук' }).hasAttribute('disabled')).toBe(true);
  });

  it('lets the user select a grouped quality for mixed episode heights', async () => {
    const user = userEvent.setup();
    const onQualityChange = vi.fn();
    const onStart = vi.fn();
    render(
      <CatalogView
        catalog={catalog}
        isFilm={false}
        voices={['Українська']}
        voice="Українська"
        onVoiceChange={vi.fn()}
        visibleEpisodes={catalog.episodes}
        selected={['first', 'second']}
        selectedCount={2}
        onSelect={vi.fn()}
        onToggle={vi.fn()}
        qualities={buildQualityOptions(catalog.episodes)}
        quality="w1920"
        onQualityChange={onQualityChange}
        folder="D:\Films"
        onFolderChange={vi.fn()}
        onBrowse={vi.fn()}
        mode="parallel"
        onModeChange={vi.fn()}
        parallel={2}
        onParallelChange={vi.fn()}
        busy={false}
        alreadyRunning={false}
        onStart={onStart}
      />,
    );
    expect(screen.getByText(/1920 × 960–1080/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Завантажити/ }));
    expect(onStart).toHaveBeenCalledOnce();
    expect(onQualityChange).not.toHaveBeenCalled();
  });

  it('filters history and disables deletion while a task is running', async () => {
    const user = userEvent.setup();
    render(
      <JobList
        jobs={[job('one', 'Детектив', 'downloading'), job('two', 'Фільм', 'complete')]}
        onAction={vi.fn()}
        onDeleteFile={vi.fn()}
        onDeleteJob={vi.fn()}
        onOpenPath={vi.fn()}
      />,
    );
    await user.type(screen.getByPlaceholderText('Пошук за назвою'), 'Детектив');
    expect(screen.getByText('Детектив')).toBeTruthy();
    expect(screen.queryByText('Фільм')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Видалити Детектив з історії' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('offers parallel controls for a season and blocks a duplicate download', async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    const onParallelChange = vi.fn();
    const onFolderChange = vi.fn();
    const onBrowse = vi.fn();
    const onStart = vi.fn();
    render(
      <DownloadSettings
        isFilm={false}
        selectedCount={2}
        qualities={buildQualityOptions(catalog.episodes)}
        quality="w1920"
        onQualityChange={vi.fn()}
        folder="D:\\Films"
        onFolderChange={onFolderChange}
        onBrowse={onBrowse}
        mode="parallel"
        onModeChange={onModeChange}
        parallel={1}
        onParallelChange={onParallelChange}
        busy={false}
        alreadyRunning
        onStart={onStart}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Усі паралельно/ }));
    expect(onParallelChange).toHaveBeenCalledWith(2);
    await user.click(screen.getByRole('button', { name: /По черзі/ }));
    expect(onModeChange).toHaveBeenCalledWith('sequential');
    await user.clear(screen.getByLabelText('Папка для збереження'));
    await user.type(screen.getByLabelText('Папка для збереження'), 'E:\\Films');
    expect(onFolderChange).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Огляд/ }));
    expect(onBrowse).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('button', { name: /Вже завантажується/ }).hasAttribute('disabled'),
    ).toBe(true);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('shows episode speed and time, then offers open and delete for a completed file', async () => {
    const user = userEvent.setup();
    const completed = job('one', 'Детектив', 'complete');
    const downloading = {
      ...completed.episodes[0],
      status: 'downloading' as const,
      phase: 'downloading' as const,
      percent: 50,
      bytes_written: 50_000_000,
      estimated_bytes: 100_000_000,
      speed_bytes: 5_000_000,
      output_file: null,
    };
    const onOpenPath = vi.fn();
    const onDeleteFile = vi.fn();
    const view = render(
      <JobEpisodeRow
        job={completed}
        episode={downloading}
        filmJob={false}
        canDelete
        onOpenPath={onOpenPath}
        onDeleteFile={onDeleteFile}
      />,
    );
    expect(screen.getByText(/50%/)).toBeTruthy();
    expect(screen.getByText(/МБ\/с/)).toBeTruthy();
    expect(screen.getByText(/≈ 1 хв/)).toBeTruthy();
    view.rerender(
      <JobEpisodeRow
        job={completed}
        episode={completed.episodes[0]}
        filmJob={false}
        canDelete
        onOpenPath={onOpenPath}
        onDeleteFile={onDeleteFile}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Відкрити серію 1' }));
    await user.click(screen.getByRole('button', { name: 'Видалити серію 1 з диска' }));
    expect(onOpenPath).toHaveBeenCalledWith('one', 'file', 'first');
    expect(onDeleteFile).toHaveBeenCalledWith(completed, 'first');
  });
});
