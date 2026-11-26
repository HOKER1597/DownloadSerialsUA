import type { Catalog } from '../../domain/catalog';
import type { DownloadJob } from '../../domain/jobs';

export function updateJob(jobs: DownloadJob[], incoming: DownloadJob): DownloadJob[] {
  return [incoming, ...jobs.filter((job) => job.id !== incoming.id)].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
}

export function filterJobs(jobs: DownloadJob[], query: string, status: string): DownloadJob[] {
  return jobs.filter(
    (job) =>
      job.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
      (status === 'all' ||
        (status === 'active'
          ? ['queued', 'downloading'].includes(job.status)
          : status === 'problems'
            ? ['failed', 'partial', 'interrupted', 'cancelled'].includes(job.status)
            : job.status === status)),
  );
}

export function selectedAlreadyRunning(
  catalog: Catalog | null,
  jobs: DownloadJob[],
  selectedEpisodeIds: string[],
): boolean {
  if (!catalog) return false;
  const selected = catalog.episodes.filter((episode) => selectedEpisodeIds.includes(episode.id));
  return jobs.some(
    (job) =>
      ['queued', 'downloading'].includes(job.status) &&
      job.title.trim().toLocaleLowerCase() === catalog.title.trim().toLocaleLowerCase() &&
      job.episodes.some(
        (running) =>
          ['queued', 'downloading'].includes(running.status) &&
          selected.some(
            (episode) =>
              episode.season === running.season &&
              episode.number === running.number &&
              episode.voice.trim().toLocaleLowerCase() === running.voice.trim().toLocaleLowerCase(),
          ),
      ),
  );
}
