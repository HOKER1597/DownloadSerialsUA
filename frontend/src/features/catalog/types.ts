import type { Catalog, Episode } from '../../domain/catalog';
import type { QualityOption } from './quality';

export interface CatalogViewProps {
  catalog: Catalog;
  isFilm: boolean;
  voices: string[];
  voice: string;
  onVoiceChange: (voice: string) => void;
  visibleEpisodes: Episode[];
  selected: string[];
  selectedCount: number;
  onSelect: (ids: string[]) => void;
  onToggle: (episode: Episode) => void;
  qualities: QualityOption[];
  quality: string;
  onQualityChange: (quality: string) => void;
  folder: string;
  onFolderChange: (folder: string) => void;
  onBrowse: () => void;
  mode: 'sequential' | 'parallel';
  onModeChange: (mode: 'sequential' | 'parallel') => void;
  parallel: number;
  onParallelChange: (parallel: number) => void;
  busy: boolean;
  alreadyRunning: boolean;
  onStart: () => void;
}
