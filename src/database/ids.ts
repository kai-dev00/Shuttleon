import { randomUUID } from "expo-crypto";

/** Client-generated primary key (UUID v4), so rows created offline never collide across devices. */
export const newId = () => randomUUID();

/** Current time as an ISO-8601 UTC string, the format used for every synced timestamp. */
export const nowIso = () => new Date().toISOString();
