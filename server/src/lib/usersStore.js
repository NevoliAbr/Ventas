// Selector del repositorio de usuarios (la "conexión" a la base de datos).
// Cambia el motor con la variable de entorno DB_DRIVER:
//   'mssql'   -> Microsoft SQL Server (driver mssql)        [local, Base_ventas]
//   'mysql'   -> MySQL / MariaDB (driver mysql2)            [producción, Plesk]
//   'sqlite'  -> SQLite, archivo server/auth.db (node:sqlite)
//   'json'    -> archivo server/data/db.json (fs)
//
// Todos los controladores/middleware importan usersRepo DESDE AQUÍ, así que
// cambiar de motor es cosa de una sola variable. Se usa import dinámico para
// no exigir dependencias del motor que no usas (p. ej. mssql).
const driver = (process.env.DB_DRIVER || 'json').trim().toLowerCase()

let usersRepo

if (driver === 'mssql') {
  usersRepo = (await import('./usersRepo.mssql.js')).usersRepo
  console.log('[db] Motor de usuarios: SQL Server (mssql)')
} else if (driver === 'mysql') {
  usersRepo = (await import('./usersRepo.mysql.js')).usersRepo
  console.log('[db] Motor de usuarios: MySQL/MariaDB (mysql2)')
} else if (driver === 'json') {
  usersRepo = (await import('./usersRepo.js')).usersRepo
  console.log('[db] Motor de usuarios: JSON (server/data/db.json)')
} else {
  usersRepo = (await import('./usersRepo.sql.js')).usersRepo
  // Migración única JSON -> SQLite si SQLite está vacío y db.json tiene datos.
  try {
    const { usersRepo: jsonRepo } = await import('./usersRepo.js')
    const enJson = jsonRepo.all()
    if (usersRepo.all().length === 0 && enJson.length > 0) {
      enJson.forEach((u) => usersRepo.importUser(u))
      console.log(`[db] Migrados ${enJson.length} usuario(s) db.json -> SQLite`)
    }
  } catch (e) {
    console.warn('[db] Migración JSON->SQLite omitida:', e.message)
  }
  console.log('[db] Motor de usuarios: SQLite (server/auth.db)')
}

export { usersRepo }
