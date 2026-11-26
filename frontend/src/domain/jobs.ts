export interface EpisodeProgress {
  episode_id: string;
  number: number;
  season: number | null;
  voice: string;
  status: 'queued' | 'downloading' | 'complete' | 'failed' | 'cancelled' | 'deleted';
  percent: number;
  bytes_written: number;
  estimated_bytes: number;
  speed_bytes: number;
  phase: 'queued' | 'downloading' | 'assembling' | 'verifying' | 'complete';
  speed: string;
  output_file: string | null;
  partial_file: string | null;
  error: string | null;
}

export interface DownloadJob {
  id: string;
  catalog_id: string;
  title: string;
  quality: string;
  resolution: string;
  output_dir: string;
  parallel_limit: number;
  status:
    | 'queued'
    | 'downloading'
    | 'complete'
    | 'partial'
    | 'failed'
    | 'cancelled'
    | 'interrupted'
    | 'deleted'
    | 'mixed';
  episodes: EpisodeProgress[];
  estimated_bytes: number;
  created_at: string;
}
