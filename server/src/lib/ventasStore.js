// Selector del repositorio de ventas según DB_DRIVER (ver catalogoStore.js).
//   'mysql' -> MySQL / MariaDB   |   otro -> SQL Server (por defecto)
const driver = (process.env.DB_DRIVER || 'mssql').toLowerCase()

const mod = driver === 'mysql'
  ? await import('./ventasRepo.mysql.js')
  : await import('./ventasRepo.mssql.js')

export const { ventasRepo } = mod
