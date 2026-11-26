import { Check } from 'lucide-react';
import { frame } from '../../shared/format';
import type { CatalogViewProps } from './types';

type Props = Pick<
  CatalogViewProps,
  | 'catalog'
  | 'isFilm'
  | 'voices'
  | 'voice'
  | 'onVoiceChange'
  | 'visibleEpisodes'
  | 'selected'
  | 'onSelect'
  | 'onToggle'
>;

export function EpisodeList({
  catalog,
  isFilm,
  voices,
  voice,
  onVoiceChange,
  visibleEpisodes,
  selected,
  onSelect,
  onToggle,
}: Props) {
  return (
    <section className="content-block">
      <div className="block-title">
        <div>
          <h3>{isFilm ? 'Фільм' : 'Серії'}</h3>
          <p>{isFilm ? 'Доступний для завантаження' : 'Виберіть потрібні епізоди'}</p>
        </div>
        {!isFilm && (
          <div className="selection-actions">
            <button
              type="button"
              onClick={() => onSelect(visibleEpisodes.map((episode) => episode.id))}
            >
              Усі
            </button>
            <button type="button" onClick={() => onSelect([])}>
              Жодної
            </button>
          </div>
        )}
      </div>
      {voices.length > 1 && (
        <div className="voice-tabs" role="tablist" aria-label="Озвучення">
          {voices.map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={item === voice}
              className={item === voice ? 'active' : ''}
              onClick={() => onVoiceChange(item)}
              key={item}
            >
              {item}
            </button>
          ))}
        </div>
      )}
      <div className="episode-list">
        {visibleEpisodes.map((episode) => (
          <label
            className={`episode-row ${selected.includes(episode.id) ? 'selected' : ''}`}
            key={episode.id}
          >
            <input
              type="checkbox"
              checked={selected.includes(episode.id)}
              onChange={() => onToggle(episode)}
            />
            <span className="custom-check">
              {selected.includes(episode.id) && <Check size={14} strokeWidth={3} />}
            </span>
            <span className="episode-number">
              {episode.season
                ? `S${String(episode.season).padStart(2, '0')}E${String(episode.number).padStart(2, '0')}`
                : 'Фільм'}
            </span>
            <span className="episode-name">
              {episode.season ? `Серія ${episode.number}` : catalog.title}
              <small>{episode.voice}</small>
            </span>
            <span className="episode-variants">
              {episode.variants.length
                ? episode.variants
                    .map((variant) => frame(variant.width, variant.height, variant.label))
                    .join(' / ')
                : 'Недоступно'}
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
