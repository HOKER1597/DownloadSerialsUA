import { Check, CircleAlert, ExternalLink, LoaderCircle, Trash2 } from 'lucide-react';
import type { DownloadJob, EpisodeProgress } from '../../domain/jobs';
import { remaining, size } from '../../shared/format';
import { phaseText, statusText } from '../../shared/statuses';

interface JobEpisodeRowProps {
  job: DownloadJob;
  episode: EpisodeProgress;
  filmJob: boolean;
  canDelete: boolean;
  onDeleteFile: (job: DownloadJob, episodeId: string) => void;
  onOpenPath: (jobId: string, kind: 'folder' | 'file', episodeId?: string) => void;
}

export function JobEpisodeRow({
  job,
  episode,
  filmJob,
  canDelete,
  onDeleteFile,
  onOpenPath,
}: JobEpisodeRowProps) {
  return (
    <div className="job-episode">
      <span className="job-episode-icon">
        {episode.status === 'complete' ? (
          <Check size={14} />
        ) : episode.status === 'downloading' ? (
          <LoaderCircle className="spin" size={14} />
        ) : episode.status === 'failed' ? (
          <CircleAlert size={14} />
        ) : (
          <span />
        )}
      </span>
      <span>{filmJob ? 'Фільм' : `Серія ${episode.number}`}</span>
      <small>
        {episode.status === 'downloading' ? (
          <>
            {phaseText(episode.phase)} · {episode.percent.toFixed(0)}%<br />
            {size(episode.bytes_written)} / ≈ {size(episode.estimated_bytes)}
            {episode.phase === 'downloading' && episode.speed_bytes > 0
              ? ` · ${size(episode.speed_bytes)}/с · ${remaining(Math.max(0, episode.estimated_bytes - episode.bytes_written) / episode.speed_bytes)}`
              : ''}
          </>
        ) : (
          statusText[episode.status]
        )}
      </small>
      {episode.error && <em title={episode.error}>!</em>}
      {episode.status === 'complete' && episode.output_file && (
        <button
          className="file-open"
          type="button"
          title="Відкрити файл"
          aria-label={`Відкрити ${filmJob ? 'фільм' : `серію ${episode.number}`}`}
          onClick={() => onOpenPath(job.id, 'file', episode.episode_id)}
        >
          <ExternalLink size={15} />
        </button>
      )}
      {canDelete && episode.status === 'complete' && episode.output_file && (
        <button
          className="file-delete"
          type="button"
          title="Видалити файл з диска"
          aria-label={`Видалити ${filmJob ? 'фільм' : `серію ${episode.number}`} з диска`}
          onClick={() => onDeleteFile(job, episode.episode_id)}
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
