import { ArrowDownToLine, Check, FolderOpen, LoaderCircle, Zap } from 'lucide-react';
import { size } from '../../shared/format';
import type { CatalogViewProps } from './types';

type Props = Pick<
  CatalogViewProps,
  | 'isFilm'
  | 'selectedCount'
  | 'qualities'
  | 'quality'
  | 'onQualityChange'
  | 'folder'
  | 'onFolderChange'
  | 'onBrowse'
  | 'mode'
  | 'onModeChange'
  | 'parallel'
  | 'onParallelChange'
  | 'busy'
  | 'alreadyRunning'
  | 'onStart'
>;

export function DownloadSettings({
  isFilm,
  selectedCount,
  qualities,
  quality,
  onQualityChange,
  folder,
  onFolderChange,
  onBrowse,
  mode,
  onModeChange,
  parallel,
  onParallelChange,
  busy,
  alreadyRunning,
  onStart,
}: Props) {
  const chosenQuality = qualities.find((option) => option.label === quality);
  return (
    <section className="content-block settings-block">
      <div className="block-title">
        <div>
          <h3>Параметри</h3>
          <p>Якість і місце збереження</p>
        </div>
      </div>
      <label className="field-label">Якість</label>
      <div className="quality-grid">
        {qualities.map((option) => (
          <button
            type="button"
            key={option.label}
            className={`quality-option ${quality === option.label ? 'active' : ''}`}
            disabled={option.count !== selectedCount}
            onClick={() => onQualityChange(option.label)}
          >
            <span className="quality-head">
              <strong>{option.name}</strong>
              {quality === option.label && <Check size={18} />}
            </span>
            <span>
              {option.dimensions} · ≈ {size(option.estimate)}
            </span>
            <small>{isFilm ? 'доступно' : `${option.count}/${selectedCount} серій`}</small>
          </button>
        ))}
      </div>
      <label className="field-label" htmlFor="output-folder">
        Папка для збереження
      </label>
      <div className="folder-line">
        <input
          id="output-folder"
          value={folder}
          onChange={(event) => onFolderChange(event.target.value)}
          placeholder="Папка «Завантаження»"
        />
        <button type="button" onClick={onBrowse}>
          <FolderOpen size={18} /> Огляд
        </button>
      </div>
      {selectedCount > 1 && (
        <>
          <label className="field-label">Режим завантаження</label>
          <div className="mode-grid">
            <button
              type="button"
              className={mode === 'sequential' ? 'mode active' : 'mode'}
              onClick={() => onModeChange('sequential')}
            >
              <span>
                <ArrowDownToLine size={19} /> По черзі
              </span>
              <small>Одна серія за раз</small>
            </button>
            <button
              type="button"
              className={mode === 'parallel' ? 'mode active' : 'mode'}
              onClick={() => onModeChange('parallel')}
            >
              <span>
                <Zap size={19} /> Паралельно
              </span>
              <small>Кілька серій одночасно</small>
            </button>
          </div>
          {mode === 'parallel' && (
            <div className="parallel-line">
              <label htmlFor="parallel-count">Одночасних серій</label>
              <input
                id="parallel-count"
                type="number"
                min={1}
                max={Math.min(35, selectedCount || 1)}
                value={parallel}
                onChange={(event) => onParallelChange(Number(event.target.value))}
              />
              <button type="button" onClick={() => onParallelChange(Math.min(35, selectedCount))}>
                Усі паралельно
              </button>
            </div>
          )}
        </>
      )}
      <div className="download-footer">
        <div>
          <strong>
            {isFilm ? 'Фільм' : `${selectedCount} ${selectedCount === 1 ? 'серія' : 'серій'}`}
          </strong>
          <span>≈ {size(chosenQuality?.estimate || 0)} до завантаження</span>
        </div>
        <button
          className="primary-button download-button"
          type="button"
          disabled={busy || !selectedCount || !quality || !folder.trim() || alreadyRunning}
          onClick={onStart}
        >
          {alreadyRunning ? (
            <>
              <LoaderCircle className="spin" size={20} /> Вже завантажується
            </>
          ) : (
            <>
              <ArrowDownToLine size={20} /> Завантажити
            </>
          )}
        </button>
      </div>
    </section>
  );
}
