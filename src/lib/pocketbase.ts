import PocketBase from 'pocketbase';

/**
 * Base URL of the self-hosted PocketBase instance.
 * The `notes` collection is publicly readable/writable in the prototype phase,
 * so no auth token is attached to the client (see CLAUDE.md / SPEC.md).
 */
export const POCKETBASE_URL = 'https://pb.job-joseph.com';

export const pb = new PocketBase(POCKETBASE_URL);

export default pb;
