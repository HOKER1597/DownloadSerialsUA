import { useEffect, useState } from 'react';
import { api } from '../../api/index';
import type { DownloadJob } from '../../domain/jobs';
import { updateJob } from './history';

export function useJobs(onMessage: (message: string) => void) {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);

  useEffect(() => {
    api
      .jobs()
      .then(setJobs)
      .catch(() => undefined);
  }, []);

  function receive(job: DownloadJob) {
    setJobs((current) => updateJob(current, job));
  }

  async function action(id: string, type: 'cancel' | 'retry') {
    try {
      receive(await api[type](id));
    } catch (error) {
      onMessage((error as Error).message);
    }
  }

  async function deleteFile(job: DownloadJob, episodeId: string) {
    const episode = job.episodes.find((item) => item.episode_id === episodeId);
    if (
      !episode?.output_file ||
      !window.confirm(
        `Видалити файл з диска?\n${episode.output_file}\n\nЦю дію не можна скасувати.`,
      )
    )
      return;
    try {
      receive(await api.deleteFile(job.id, episodeId));
      onMessage('Файл видалено з диска.');
    } catch (error) {
      onMessage((error as Error).message);
    }
  }

  async function deleteJob(job: DownloadJob) {
    const existingFiles = job.episodes.filter(
      (episode) => episode.output_file && episode.status === 'complete',
    ).length;
    const partialFiles = job.episodes.filter((episode) => episode.partial_file).length;
    const totalFiles = existingFiles + partialFiles;
    const detail = totalFiles
      ? `\nФайли цього завдання також буде видалено (${totalFiles}).`
      : '\nФайлів для видалення немає — буде стерто лише запис історії.';
    if (!window.confirm(`Видалити це завдання з історії?${detail}\nДію не можна скасувати.`))
      return;
    try {
      await api.deleteJob(job.id);
      setJobs((current) => current.filter((item) => item.id !== job.id));
      onMessage(totalFiles ? 'Завдання та його відеофайли видалено.' : 'Запис історії видалено.');
    } catch (error) {
      onMessage((error as Error).message);
    }
  }

  async function openPath(jobId: string, kind: 'folder' | 'file', episodeId?: string) {
    try {
      await api.openPath(jobId, kind, episodeId);
    } catch (error) {
      onMessage((error as Error).message);
    }
  }

  return { jobs, receive, action, deleteFile, deleteJob, openPath };
}
