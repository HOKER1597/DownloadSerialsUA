import { useState } from 'react';
import { ArrowDownToLine } from 'lucide-react';
import type { DownloadJob } from '../../domain/jobs';
import { filterJobs } from './history';
import { JobCard } from './JobCard';

interface JobListProps {
  jobs: DownloadJob[];
  onAction: (id: string, type: 'cancel' | 'retry') => void;
  onDeleteFile: (job: DownloadJob, episodeId: string) => void;
  onDeleteJob: (job: DownloadJob) => void;
  onOpenPath: (jobId: string, kind: 'folder' | 'file', episodeId?: string) => void;
}

export function JobList({ jobs, onAction, onDeleteFile, onDeleteJob, onOpenPath }: JobListProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const activeCount = jobs.filter((job) =>
    ['queued', 'downloading', 'partial', 'failed', 'interrupted'].includes(job.status),
  ).length;
  const visibleJobs = filterJobs(jobs, query, status);

  return (
    <aside className="queue-column">
      <div className="queue-heading">
        <div>
          <h2>Завантаження</h2>
          <p>{activeCount ? `${activeCount} активних завдань` : 'Історія завантажень'}</p>
        </div>
        <span className="queue-count">{jobs.length}</span>
      </div>
      <div className="history-filters">
        <label>
          <span className="sr-only">Пошук в історії</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Пошук за назвою"
          />
        </label>
        <label>
          <span className="sr-only">Стан завантаження</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Усі стани</option>
            <option value="active">Завантажуються</option>
            <option value="complete">Готові</option>
            <option value="problems">Помилки й перервані</option>
          </select>
        </label>
      </div>
      {!jobs.length ? (
        <div className="queue-empty">
          <div className="empty-symbol">
            <ArrowDownToLine size={28} />
          </div>
          <strong>Поки що порожньо</strong>
          <p>Знайдіть фільм або серії та натисніть «Завантажити». Тут з’явиться прогрес.</p>
        </div>
      ) : !visibleJobs.length ? (
        <div className="queue-empty">
          <strong>Нічого не знайдено</strong>
          <p>Змініть пошук або фільтр стану.</p>
        </div>
      ) : (
        <div className="job-list">
          {visibleJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onAction={onAction}
              onDeleteFile={onDeleteFile}
              onDeleteJob={onDeleteJob}
              onOpenPath={onOpenPath}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
