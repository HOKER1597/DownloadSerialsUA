import { CircleAlert, LoaderCircle } from 'lucide-react';
import type { ScanState } from '../../domain/catalog';

export function ScanStatus({ scan, message }: { scan: ScanState | null; message: string }) {
  return (
    <>
      {message && (
        <div className="notice" role="status">
          <CircleAlert size={18} />
          {message}
        </div>
      )}
      {scan?.status === 'scanning' && (
        <section className="scan-state">
          <LoaderCircle className="spin" size={22} />
          <div>
            <strong>{scan.message}</strong>
            <span>
              {scan.total ? `${scan.done} із ${scan.total} серій` : 'Список серій з’явиться тут'}
            </span>
          </div>
        </section>
      )}
      {scan?.status === 'failed' && (
        <div className="notice error" role="alert">
          <CircleAlert size={18} />
          {scan.error}
        </div>
      )}
    </>
  );
}
