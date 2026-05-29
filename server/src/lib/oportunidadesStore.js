// Selector del repositorio de oportunidades según DB_DRIVER (ver catalogoStore.js).
//   'mysql' -> MySQL / MariaDB   |   otro -> SQL Server (por defecto)
const driver = (process.env.DB_DRIVER || 'mysql').trim().toLowerCase()

const mod = driver === 'mysql'
  ? await import('./oportunidadesRepo.mysql.js')
  : await import('./oportunidadesRepo.mssql.js')

export const { oportunidadesRepo } = mod
