export interface Variant {
  label: string;
  width: number;
  height: number;
  bandwidth: number;
  duration_seconds: number;
  estimated_bytes: number;
}

export interface Episode {
  id: string;
  number: number;
  season: number | null;
  voice: string;
  source_url: string;
  variants: Variant[];
}

export interface Catalog {
  id: string;
  source_url: string;
  site: 'UAKINO' | 'UAFLIX';
  title: string;
  season: number | null;
  episodes: Episode[];
}

export interface ScanState {
  id: string;
  status: 'scanning' | 'complete' | 'failed';
  message: string;
  done: number;
  total: number;
  catalog: Catalog | null;
  error: string | null;
}
