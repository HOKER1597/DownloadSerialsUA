export const statusText: Record<string, string> = {
  queued: 'У черзі',
  downloading: 'Завантажується',
  complete: 'Готово',
  partial: 'Частково готово',
  failed: 'Помилка',
  cancelled: 'Скасовано',
  interrupted: 'Перервано',
  deleted: 'Видалено',
  mixed: 'Частину файлів видалено',
};

export function phaseText(phase: string): string {
  return (
    (
      {
        downloading: 'Завантаження',
        assembling: 'Збирання MP4',
        verifying: 'Перевірка файлу',
      } as Record<string, string>
    )[phase] || 'У черзі'
  );
}
