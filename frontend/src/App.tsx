import { useEffect, useState } from 'react';
import { Clapperboard } from 'lucide-react';
import { api, connectEvents, token } from './api/index';
import { CatalogView } from './features/catalog/CatalogView';
import { useFolder } from './features/catalog/useFolder';
import { useSelection } from './features/catalog/useSelection';
import { selectedAlreadyRunning } from './features/downloads/history';
import { JobList } from './features/downloads/JobList';
import { useJobs } from './features/downloads/useJobs';
import { ScanStatus } from './features/search/ScanStatus';
import { SearchForm } from './features/search/SearchForm';
import { useScan } from './features/search/useScan';

export default function App() {
  const [message, setMessage] = useState('');
  const [downloadBusy, setDownloadBusy] = useState(false);
  const { url, setUrl, scan, setScan, busy: scanBusy, search } = useScan(setMessage);
  const catalog = scan?.catalog || null;
  const selection = useSelection(catalog);
  const { folder, setFolder, browse } = useFolder(setMessage);
  const { jobs, receive, action, deleteFile, deleteJob, openPath } = useJobs(setMessage);
  const busy = scanBusy || downloadBusy;
  const isFilm = !!catalog && catalog.episodes.length === 1 && catalog.episodes[0].season === null;
  const alreadyRunning = selectedAlreadyRunning(catalog, jobs, selection.selected);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let timer: number;
    const open = () => {
      socket = connectEvents((event) => {
        if (event.type === 'job' && event.job) receive(event.job);
        if (event.type === 'scan' && event.scan) setScan(event.scan);
      });
      socket.onclose = () => {
        timer = window.setTimeout(open, 2000);
      };
    };
    if (token) open();
    return () => {
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      window.clearTimeout(timer);
    };
  }, []);

  async function start() {
    if (!catalog || !selection.quality || !selection.selected.length || !scan) return;
    setDownloadBusy(true);
    setMessage('');
    try {
      const created = await api.start({
        catalog_id: scan.id,
        episode_ids: selection.selected,
        quality: selection.quality,
        output_dir: folder.trim(),
        parallel_limit:
          selection.mode === 'sequential'
            ? 1
            : Math.min(selection.parallel, selection.selected.length, 35),
      });
      receive(created);
      setMessage(
        'Завантаження розпочато. Вкладку можна закрити — локальна служба продовжить роботу.',
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setDownloadBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Clapperboard size={22} strokeWidth={2.2} />
          </span>
          <span>Кадр</span>
        </div>
        <span className="topbar-note">
          <span className="connection-dot" /> Локальний застосунок
        </span>
      </header>

      <main className="layout">
        <section className="main-column">
          <div className="intro">
            <p className="intro-kicker">Відео зберігається на вашому комп’ютері</p>
            <h1>
              Збережіть фільм.
              <br />
              Серію або весь сезон.
            </h1>
            <p className="intro-copy">
              Вставте посилання з UAKINO або UAFLIX. Оберіть якість, папку та спосіб завантаження.
            </p>
          </div>
          <SearchForm
            url={url}
            onUrlChange={setUrl}
            onSearch={search}
            busy={busy}
            scanning={scan?.status === 'scanning'}
          />
          <ScanStatus scan={scan} message={message} />
          {catalog && (
            <CatalogView
              catalog={catalog}
              isFilm={isFilm}
              voices={selection.voices}
              voice={selection.voice}
              onVoiceChange={selection.setVoice}
              visibleEpisodes={selection.visibleEpisodes}
              selected={selection.selected}
              selectedCount={selection.selectedEpisodes.length}
              onSelect={selection.setSelected}
              onToggle={selection.toggle}
              qualities={selection.qualities}
              quality={selection.quality}
              onQualityChange={selection.setQuality}
              folder={folder}
              onFolderChange={setFolder}
              onBrowse={browse}
              mode={selection.mode}
              onModeChange={selection.setMode}
              parallel={selection.parallel}
              onParallelChange={selection.setParallel}
              busy={busy}
              alreadyRunning={alreadyRunning}
              onStart={start}
            />
          )}
        </section>
        <JobList
          jobs={jobs}
          onAction={action}
          onDeleteFile={deleteFile}
          onDeleteJob={deleteJob}
          onOpenPath={openPath}
        />
      </main>
      <footer className="site-footer">
        Кадр працює лише на вашому комп’ютері. Підтримуються доступні потоки UAKINO та UAFLIX.
      </footer>
    </div>
  );
}
