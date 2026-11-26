import { useEffect, useMemo, useState } from 'react';
import type { Catalog, Episode } from '../../domain/catalog';
import { buildQualityOptions } from './quality';

export function useSelection(catalog: Catalog | null) {
  const [voice, setVoice] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [quality, setQuality] = useState('');
  const [mode, setMode] = useState<'sequential' | 'parallel'>('parallel');
  const [parallel, setParallel] = useState(4);

  const voices = useMemo(
    () => [...new Set(catalog?.episodes.map((episode) => episode.voice) || [])],
    [catalog],
  );
  const visibleEpisodes = useMemo(
    () => (catalog?.episodes || []).filter((episode) => episode.voice === voice),
    [catalog, voice],
  );
  const selectedEpisodes = useMemo(
    () => visibleEpisodes.filter((episode) => selected.includes(episode.id)),
    [visibleEpisodes, selected],
  );
  const qualities = useMemo(() => buildQualityOptions(selectedEpisodes), [selectedEpisodes]);

  useEffect(() => {
    if (!catalog) return;
    const nextVoice = voices.includes(voice) ? voice : voices[0] || '';
    if (nextVoice !== voice) setVoice(nextVoice);
  }, [catalog?.id, voices, voice]);

  useEffect(() => {
    if (!catalog || !voice) return;
    setSelected(
      catalog.episodes.filter((episode) => episode.voice === voice).map((episode) => episode.id),
    );
  }, [catalog?.id, voice]);

  useEffect(() => {
    if (
      !qualities.some((item) => item.label === quality && item.count === selectedEpisodes.length)
    ) {
      setQuality(qualities.find((item) => item.count === selectedEpisodes.length)?.label || '');
    }
  }, [qualities, quality, selectedEpisodes.length]);

  function toggle(episode: Episode) {
    setSelected((current) =>
      current.includes(episode.id)
        ? current.filter((id) => id !== episode.id)
        : [...current, episode.id],
    );
  }

  return {
    voice,
    setVoice,
    selected,
    setSelected,
    quality,
    setQuality,
    mode,
    setMode,
    parallel,
    setParallel,
    voices,
    visibleEpisodes,
    selectedEpisodes,
    qualities,
    toggle,
  };
}
