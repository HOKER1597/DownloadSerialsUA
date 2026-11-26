import { useEffect, useState } from 'react';
import { api } from '../../api/index';

export function useFolder(onError: (message: string) => void) {
  const [folder, setFolder] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .getFolder()
      .then((result) => setFolder(result.path))
      .catch((error) => onError((error as Error).message))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => {
      api.saveFolder(folder).catch((error) => onError((error as Error).message));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [folder, loaded]);

  async function browse() {
    try {
      const result = await api.chooseFolder(folder);
      if (result.path) setFolder(result.path);
    } catch (error) {
      onError((error as Error).message);
    }
  }

  return { folder, setFolder, browse };
}
