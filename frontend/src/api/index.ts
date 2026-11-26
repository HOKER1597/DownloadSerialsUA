import { scansApi } from './scans';
import { jobsApi } from './jobs';
import { foldersApi } from './folders';

export { token } from './client';
export { connectEvents } from './events';
export const api = { ...scansApi, ...jobsApi, ...foldersApi };
