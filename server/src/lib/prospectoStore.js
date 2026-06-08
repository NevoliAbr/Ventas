const driver = (process.env.DB_DRIVER || 'mysql').trim().toLowerCase()

const mod = driver === 'mysql'
  ? await import('./prospectoRepo.mysql.js')
  : await import('./prospectoRepo.mssql.js')

export const { prospectoRepo } = mod
