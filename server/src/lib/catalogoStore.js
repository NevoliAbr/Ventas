// Selector del repositorio de catálogo según DB_DRIVER.
//   'mysql' -> MySQL / MariaDB (catalogoRepo.mysql.js)  [producción / Plesk]
//   otro    -> SQL Server      (catalogoRepo.mssql.js)  [local, por defecto]
// Los controladores importan el catálogo DESDE AQUÍ, así un solo DB_DRIVER
// alterna todo. Import dinámico: solo se carga el driver elegido.
const driver = (process.env.DB_DRIVER || 'mssql').trim().toLowerCase()

const mod = driver === 'mysql'
  ? await import('./catalogoRepo.mysql.js')
  : await import('./catalogoRepo.mssql.js')

console.log(`[db] Motor de catálogo: ${driver === 'mysql' ? 'MySQL/MariaDB' : 'SQL Server'}`)

export const { unidades, clientes, productos, tiposVenta } = mod
