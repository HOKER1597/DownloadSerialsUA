import { describe, expect, it } from 'vitest';
import { filterJobs, selectedAlreadyRunning, updateJob } from '../src/features/downloads/history';
import type { Catalog } from '../src/domain/catalog';
import type { DownloadJob } from '../src/domain/jobs';

function job(id: string, title: string, status: DownloadJob['status']): DownloadJob {
  return {
    id,
    catalog_id: 'scan',
    title,
    quality: 'w1920',
    resolution: '1920 × 1080',
    output_dir: 'D:\Films',
    parallel_limit: 1,
    status,
    estimated_bytes: 100,
    created_at: `2026-11-25T00:00:0${id}Z`,
    episodes: [
      {
        episode_id: 'e1',
        number: 1,
        season: 1,
        voice: 'Українська',
        status: 'downloading',
        percent: 20,
        bytes_written: 20,
        estimated_bytes: 100,
        speed_bytes: 1,
        phase: 'downloading',
        speed: '1x',
        output_file: null,
        partial_file: null,
        error: null,
      },
    ],
  };
}

describe('download history', () => {
  it('replaces job progress without adding a duplicate card', () => {
    const original = job('1', 'Детектив', 'queued');
    const updated = job('1', 'Детектив', 'downloading');
    expect(updateJob([original], updated)).toEqual([updated]);
  });

  it('filters by title and state', () => {
    const jobs = [job('1', 'Детектив', 'downloading'), job('2', 'Фільм', 'failed')];
    expect(filterJobs(jobs, 'детектив', 'active').map((item) => item.id)).toEqual(['1']);
    expect(filterJobs(jobs, '', 'problems').map((item) => item.id)).toEqual(['2']);
  });

  it('blocks only episodes already downloading in the same voice', () => {
    const catalog: Catalog = {
      id: 'c',
      source_url: '',
      site: 'UAKINO',
      title: 'Детектив',
      season: 1,
      episodes: [
        { id: 'e1', number: 1, season: 1, voice: 'Українська', source_url: '', variants: [] },
        { id: 'e2', number: 2, season: 1, voice: 'Українська', source_url: '', variants: [] },
      ],
    };
    expect(selectedAlreadyRunning(catalog, [job('1', 'Детектив', 'downloading')], ['e1'])).toBe(
      true,
    );
    expect(selectedAlreadyRunning(catalog, [job('1', 'Детектив', 'downloading')], ['e2'])).toBe(
      false,
    );
  });
});
