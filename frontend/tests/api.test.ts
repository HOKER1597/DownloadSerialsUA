// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/?token=secret');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('local API client', () => {
  it('keeps the launch token in session and sends it with requests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ path: 'D:\Films' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { api, token } = await import('../src/api/index');
    expect(token).toBe('secret');
    expect(window.location.search).toBe('');
    expect(await api.getFolder()).toEqual({ path: 'D:\Films' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/folder',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-App-Token': 'secret' }),
      }),
    );
  });

  it('sends scan and download requests to the documented endpoints', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response('{}', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await import('../src/api/index');
    await api.scan('https://uakino.best/show.html');
    await api.start({
      catalog_id: 'scan',
      episode_ids: ['first'],
      quality: 'w1920',
      output_dir: 'D:\Films',
      parallel_limit: 1,
    });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/scans');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/jobs');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).quality).toBe('w1920');
  });

  it('shows the backend error message for failed requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ detail: 'Немає місця' }), { status: 400 }),
        ),
    );
    const { api } = await import('../src/api/index');
    await expect(api.jobs()).rejects.toThrow('Немає місця');
  });

  it('connects to the authenticated event stream', async () => {
    let address = '';
    class FakeSocket {
      onmessage: ((message: { data: string }) => void) | null = null;
      constructor(url: string) {
        address = url;
      }
    }
    vi.stubGlobal('WebSocket', FakeSocket);
    const { connectEvents } = await import('../src/api/index');
    const listener = vi.fn();
    const socket = connectEvents(listener) as unknown as FakeSocket;
    expect(address).toContain('/api/events?token=secret');
    socket.onmessage?.({ data: JSON.stringify({ type: 'job', job: { id: 'one' } }) });
    expect(listener).toHaveBeenCalledWith({ type: 'job', job: { id: 'one' } });
  });
});
