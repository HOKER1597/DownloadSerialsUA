const url = new URL(window.location.href);
const incomingToken = url.searchParams.get('token');
if (incomingToken) {
  sessionStorage.setItem('kadr-token', incomingToken);
  url.searchParams.delete('token');
  window.history.replaceState({}, '', url.toString());
}

export const token = sessionStorage.getItem('kadr-token') || '';

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-App-Token': token, ...init.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Помилка запиту (${response.status})`);
  }
  return response.json();
}
