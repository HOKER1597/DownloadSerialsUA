import { describe, expect, it } from 'vitest';
import { buildQualityOptions, qualityName } from '../src/features/catalog/quality';
import type { Episode } from '../src/domain/catalog';

function episode(number: number, heights: number[]): Episode {
  const widths = [1920, 1280, 854];
  return {
    id: `episode-${number}`,
    number,
    season: 4,
    voice: 'Українська',
    source_url: 'https://ashdi.vip/video',
    variants: heights.map((height, index) => ({
      label: `${height}p`,
      width: widths[index],
      height,
      bandwidth: 1_000_000,
      duration_seconds: 30,
      estimated_bytes: 3_750_000,
    })),
  };
}

describe('quality groups', () => {
  it('offers three full-season tiers for mixed frame heights', () => {
    const options = buildQualityOptions([
      episode(1, [960, 640, 426]),
      episode(2, [1080, 720, 480]),
    ]);
    expect(options.map((option) => option.name)).toEqual(['1080p', '720p', '480p']);
    expect(options.map((option) => option.count)).toEqual([2, 2, 2]);
    expect(options[0].dimensions).toBe('1920 × 960–1080');
    expect(options[0].estimate).toBe(7_500_000);
  });

  it('marks a tier unavailable for the whole selection when one episode lacks it', () => {
    const options = buildQualityOptions([episode(1, [960, 640, 426]), episode(2, [1080])]);
    expect(options.find((option) => option.label === 'w1280')?.count).toBe(1);
    expect(qualityName('max')).toBe('максимальна для кожної');
  });
});
