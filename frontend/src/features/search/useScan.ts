import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../api/index';
import type { ScanState } from '../../domain/catalog';

export function useScan(onError: (message: string) => void) {
  const [url, setUrl] = useState('');
  const [scan, setScan] = useState<ScanState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const savedScan = sessionStorage.getItem('kadr-scan');
    if (savedScan)
      api
        .getScan(savedScan)
        .then(setScan)
        .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!scan || scan.status !== 'scanning') return;
    const timer = window.setInterval(
      () =>
        api
          .getScan(scan.id)
          .then(setScan)
          .catch(() => undefined),
      1500,
    );
    return () => window.clearInterval(timer);
  }, [scan?.id, scan?.status]);

  async function search(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError('');
    setScan(null);
    try {
      const created = await api.scan(url.trim());
      sessionStorage.setItem('kadr-scan', created.id);
      setScan(created);
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return { url, setUrl, scan, setScan, busy, search };
}
