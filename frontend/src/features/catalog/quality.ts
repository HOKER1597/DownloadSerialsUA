import type { Episode } from '../../domain/catalog';

export interface QualityOption {
  label: string;
  name: string;
  dimensions: string;
  count: number;
  estimate: number;
}

export function qualityName(quality: string): string {
  if (quality === 'max') return 'максимальна для кожної';
  if (/^w\d+$/.test(quality)) return `${Math.round((Number(quality.slice(1)) * 9) / 16)}p`;
  return quality;
}

export function buildQualityOptions(episodes: Episode[]): QualityOption[] {
  const widths = [
    ...new Set(
      episodes.flatMap((episode) =>
        episode.variants.map((variant) => variant.width).filter((width) => width > 0),
      ),
    ),
  ];
  const byWidth = widths
    .sort((a, b) => b - a)
    .map((width) => {
      const variants = episodes
        .map(
          (episode) =>
            episode.variants
              .filter((variant) => variant.width === width)
              .sort((a, b) => b.height - a.height || b.bandwidth - a.bandwidth)[0],
        )
        .filter((variant) => variant !== undefined);
      const heights = variants.map((variant) => variant.height).filter((height) => height > 0);
      const minimum = heights.length ? Math.min(...heights) : 0;
      const maximum = heights.length ? Math.max(...heights) : 0;
      return {
        label: `w${width}`,
        name: qualityName(`w${width}`),
        dimensions: heights.length
          ? `${width} × ${minimum}${minimum === maximum ? '' : `–${maximum}`}`
          : `${width}px`,
        count: variants.length,
        estimate: variants.reduce((total, variant) => total + variant.estimated_bytes, 0),
      };
    });
  const unknownLabels = [
    ...new Set(
      episodes.flatMap((episode) =>
        episode.variants.filter((variant) => !variant.width).map((variant) => variant.label),
      ),
    ),
  ];
  const withoutWidth = unknownLabels.map((label) => ({
    label,
    name: label,
    dimensions: label,
    count: episodes.filter((episode) => episode.variants.some((variant) => variant.label === label))
      .length,
    estimate: episodes.reduce(
      (total, episode) =>
        total + (episode.variants.find((variant) => variant.label === label)?.estimated_bytes || 0),
      0,
    ),
  }));
  return [...byWidth, ...withoutWidth];
}
