import { CatalogHeading } from './CatalogHeading';
import { DownloadSettings } from './DownloadSettings';
import { EpisodeList } from './EpisodeList';
import type { CatalogViewProps } from './types';

export function CatalogView(props: CatalogViewProps) {
  return (
    <>
      <CatalogHeading catalog={props.catalog} isFilm={props.isFilm} />
      <EpisodeList
        catalog={props.catalog}
        isFilm={props.isFilm}
        voices={props.voices}
        voice={props.voice}
        onVoiceChange={props.onVoiceChange}
        visibleEpisodes={props.visibleEpisodes}
        selected={props.selected}
        onSelect={props.onSelect}
        onToggle={props.onToggle}
      />
      <DownloadSettings
        isFilm={props.isFilm}
        selectedCount={props.selectedCount}
        qualities={props.qualities}
        quality={props.quality}
        onQualityChange={props.onQualityChange}
        folder={props.folder}
        onFolderChange={props.onFolderChange}
        onBrowse={props.onBrowse}
        mode={props.mode}
        onModeChange={props.onModeChange}
        parallel={props.parallel}
        onParallelChange={props.onParallelChange}
        busy={props.busy}
        alreadyRunning={props.alreadyRunning}
        onStart={props.onStart}
      />
    </>
  );
}
