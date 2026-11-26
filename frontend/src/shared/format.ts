export function size(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const unit = bytes >= 1024 ** 3 ? 'ГБ' : bytes >= 1024 ** 2 ? 'МБ' : 'КБ';
  const divisor = unit === 'ГБ' ? 1024 ** 3 : unit === 'МБ' ? 1024 ** 2 : 1024;
  return `${(bytes / divisor).toLocaleString('uk-UA', { maximumFractionDigits: 1 })} ${unit}`;
}

export function frame(width: number, height: number, fallback: string): string {
  return width && height ? `${width} × ${height}` : fallback;
}

export function remaining(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const minutes = Math.ceil(seconds / 60);
  return minutes < 60 ? `≈ ${minutes} хв` : `≈ ${Math.floor(minutes / 60)} год ${minutes % 60} хв`;
}
