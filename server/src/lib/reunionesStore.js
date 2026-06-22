const driver = process.env.DB_DRIVER || 'mysql'

const mod = driver === 'mssql'
  ? await import('./reunionesRepo.mssql.js')
  : await import('./reunionesRepo.mysql.js')

export const reunionesRepo = mod.reunionesRepo
