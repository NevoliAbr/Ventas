const driver = (process.env.DB_DRIVER || 'mysql').trim().toLowerCase()

const mod = driver === 'mysql'
  ? await import('./universoRepo.mysql.js')
  : await import('./universoRepo.mssql.js')

export const { universoRepo } = mod
