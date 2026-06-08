import { UNIVERSO_SEED } from './universoSeed.js'

const driver = (process.env.DB_DRIVER || 'mysql').trim().toLowerCase()

const mod = driver === 'mysql'
  ? await import('./universoRepo.mysql.js')
  : await import('./universoRepo.mssql.js')

export const { universoRepo } = mod

// Inserta los 71 prospectos iniciales si la tabla está vacía.
universoRepo.seedIfEmpty(UNIVERSO_SEED).catch((e) => console.warn('[universo] seed omitido:', e.message))
