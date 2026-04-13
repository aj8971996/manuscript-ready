/**
 * RN-bound persistence exports. Do NOT import from app-pure code —
 * pulls expo-sqlite into the module graph. App-pure code imports from
 * './persistence' (the barrel); RN code imports from './persistence/native'.
 */
export { createSqliteAdapter } from './sqlite';