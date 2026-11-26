import { FolderOpen, RotateCcw, Square, Trash2 } from 'lucide-react';
import type { DownloadJob } from '../../domain/jobs';
import { qualityName } from '../catalog/quality';
import { JobEpisodeRow } from './JobEpisodeRow';
import { remaining, size } from '../../shared/format';
import { statusText } from '../../shared/statuses';

interface JobCardProps {
  job: DownloadJob;
  onAction: (id: string, type: 'cancel' | 'retry') => void;
  onDeleteFile: (job: DownloadJob, episodeId: string) => void;
  onDeleteJob: (job: DownloadJob) => void;
  onOpenPath: (jobId: string, kind: 'folder' | 'file', episodeId?: string) => void;
}

export function JobCard({ job, onAction, onDeleteFile, onDeleteJob, onOpenPath }: JobCardProps) {
  const complete = job.episodes.filter((episode) => episode.status === 'complete').length;
  const progress = job.episodes.length
    ? Math.round(
        job.episodes.reduce((sum, episode) => sum + episode.percent, 0) / job.episodes.length,
      )
    : 0;
  const filmJob = job.episodes.length === 1 && job.episodes[0].season === null;
  const seasons = [
    ...new Set(
      job.episodes
        .map((episode) => episode.season)
        .filter((season): season is number => season !== null),
    ),
  ];
  const seasonLabel = seasons.length === 1 ? ` · ${seasons[0]} сезон` : '';
  const canDelete = !['queued', 'downloading'].includes(job.status);
  const canRetry = job.episodes.some((episode) => ['failed', 'cancelled'].includes(episode.status));
  const written = job.episodes.reduce((sum, episode) => sum + episode.bytes_written, 0);
  const estimated =
    job.episodes.reduce((sum, episode) => sum + episode.estimated_bytes, 0) || job.estimated_bytes;
  const speedBytes = job.episodes.reduce(
    (sum, episode) =>
      sum +
      (episode.status === 'downloading' && episode.phase === 'downloading'
        ? episode.speed_bytes
        : 0),
    0,
  );
  const remainingBytes = job.episodes.reduce(
    (sum, episode) =>
      sum +
      (episode.status === 'complete'
        ? 0
        : Math.max(0, episode.estimated_bytes - episode.bytes_written)),
    0,
  );

  return (
    <article className="job-card">
      <div className="job-top">
        <div>
          <strong>{job.title}</strong>
          <span>
            {filmJob ? 'Фільм' : `${job.episodes.length} серій${seasonLabel}`} ·{' '}
            {job.resolution
              ? `${job.resolution} (${qualityName(job.quality)})`
              : qualityName(job.quality)}
          </span>
          <span className="job-location">Папка: {job.output_dir}</span>
        </div>
        <div className="job-top-actions">
          <span className={`job-status ${job.status}`}>{statusText[job.status]}</span>
          <button
            className="history-delete"
            type="button"
            title="Відкрити папку"
            aria-label={`Відкрити папку ${job.title}`}
            onClick={() => onOpenPath(job.id, 'folder')}
          >
            <FolderOpen size={16} />
          </button>
          <button
            className="history-delete"
            type="button"
            disabled={!canDelete}
            title={canDelete ? 'Видалити завдання й запис історії' : 'Спочатку скасуйте завдання'}
            aria-label={`Видалити ${job.title} з історії`}
            onClick={() => onDeleteJob(job)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="job-progress">
        <div style={{ width: `${progress}%` }} />
      </div>
      <div className="job-summary">
        <span>
          {complete}/{job.episodes.length} готово
        </span>
        <span>{progress}%</span>
      </div>
      <div className="job-transfer">
        <span>
          {size(written)} / ≈ {size(estimated)}
        </span>
        {job.status === 'downloading' && (
          <span>
            {speedBytes > 0
              ? `${size(speedBytes)}/с · ${remaining(remainingBytes > 0 ? remainingBytes / speedBytes : Math.max(0, estimated - written) / speedBytes)}`
              : 'Швидкість і час: обчислюються'}
          </span>
        )}
      </div>
      <div className="job-episodes">
        {job.episodes.map((episode) => (
          <JobEpisodeRow
            key={episode.episode_id}
            job={job}
            episode={episode}
            filmJob={filmJob}
            canDelete={canDelete}
            onDeleteFile={onDeleteFile}
            onOpenPath={onOpenPath}
          />
        ))}
      </div>
      <div className="job-actions">
        {['queued', 'downloading'].includes(job.status) && (
          <button type="button" onClick={() => onAction(job.id, 'cancel')}>
            <Square size={14} /> Скасувати
          </button>
        )}
        {canRetry && canDelete && (
          <button type="button" onClick={() => onAction(job.id, 'retry')}>
            <RotateCcw size={14} /> Повторити невдалі
          </button>
        )}
      </div>
    </article>
  );
}
