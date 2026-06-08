// Conexión compartida a MySQL / MariaDB + creación del esquema.
// Es el espejo de mssql.js para el entorno de producción (Plesk -> MariaDB).
// Mismo patrón: un pool perezoso que crea las tablas la primera vez.
import mysql from 'mysql2/promise'

const config = {
  host: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'Ventas_Base',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Devuelve los DECIMAL como número (no string) para que las comparaciones
  // de precios en los controladores funcionen igual que en SQL Server.
  decimalNumbers: true,
}

let poolPromise = null

export function getPool() {
  if (!poolPromise) {
    poolPromise = (async () => {
      const pool = mysql.createPool(config)
      await ensureSchema(pool)
      console.log(`[db] Conectado a MySQL/MariaDB: ${config.host}:${config.port}/${config.database}`)
      return pool
    })().catch((e) => {
      poolPromise = null // permite reintentar
      throw e
    })
  }
  return poolPromise
}

// Crea las tablas si no existen (idempotente). Mismo esquema que mssql.js,
// traducido a tipos MySQL (NVARCHAR->VARCHAR, NVARCHAR(MAX)->TEXT, BIT->TINYINT).
async function ensureSchema(pool) {
  const tablas = [
    `CREATE TABLE IF NOT EXISTS users (
      id           VARCHAR(64)  NOT NULL PRIMARY KEY,
      nombre       VARCHAR(200) NOT NULL,
      email        VARCHAR(320) NOT NULL,
      password     VARCHAR(255) NOT NULL,
      role         VARCHAR(20)  NOT NULL DEFAULT 'user',
      facultades   TEXT         NULL,
      resetToken   VARCHAR(128) NULL,
      resetExpires BIGINT       NULL,
      createdAt    VARCHAR(40)  NOT NULL,
      UNIQUE KEY uq_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS unidades (
      id          VARCHAR(64)  NOT NULL PRIMARY KEY,
      nombre      VARCHAR(100) NOT NULL,
      abreviatura VARCHAR(20)  NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS clientes (
      id       VARCHAR(64)  NOT NULL PRIMARY KEY,
      nombre   VARCHAR(200) NOT NULL,
      email    VARCHAR(320) NULL,
      telefono VARCHAR(50)  NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS productos (
      id        VARCHAR(64)  NOT NULL PRIMARY KEY,
      nombre    VARCHAR(200) NOT NULL,
      tipo      VARCHAR(20)  NOT NULL,
      sector    VARCHAR(100) NULL,
      unidad_id VARCHAR(64)  NULL,
      activo    TINYINT(1)   NOT NULL DEFAULT 1,
      createdAt VARCHAR(40)  NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS tipos_venta (
      id           VARCHAR(64)   NOT NULL PRIMARY KEY,
      producto_id  VARCHAR(64)   NOT NULL,
      nombre       VARCHAR(200)  NOT NULL,
      segmento     VARCHAR(200)  NULL,
      unidades_min INT           NOT NULL DEFAULT 1,
      unidades_max INT           NULL,
      precio_piso  DECIMAL(18,2) NOT NULL DEFAULT 0,
      precio_lista DECIMAL(18,2) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS ventas (
      id         VARCHAR(64)   NOT NULL PRIMARY KEY,
      folio      VARCHAR(40)   NULL,
      cliente_id VARCHAR(64)   NULL,
      fecha      VARCHAR(40)   NOT NULL,
      notas      TEXT          NULL,
      total      DECIMAL(18,2) NOT NULL DEFAULT 0,
      createdBy  VARCHAR(64)   NULL,
      createdAt  VARCHAR(40)   NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS venta_items (
      id              VARCHAR(64)   NOT NULL PRIMARY KEY,
      venta_id        VARCHAR(64)   NOT NULL,
      producto_id     VARCHAR(64)   NULL,
      tipo_venta_id   VARCHAR(64)   NULL,
      descripcion     VARCHAR(300)  NULL,
      unidad          VARCHAR(50)   NULL,
      cantidad        DECIMAL(18,2) NOT NULL,
      anios           INT           NULL,
      precio_unitario DECIMAL(18,2) NOT NULL,
      ingreso_mensual DECIMAL(18,2) NULL,
      ingreso_anual   DECIMAL(18,2) NULL,
      subtotal        DECIMAL(18,2) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS oportunidades (
      id              VARCHAR(64)   NOT NULL PRIMARY KEY,
      prospecto       VARCHAR(200)  NOT NULL,
      sector          VARCHAR(100)  NULL,
      producto_id     VARCHAR(64)   NULL,
      tipo_venta_id   VARCHAR(64)   NULL,
      descripcion     VARCHAR(300)  NULL,
      unidades        INT           NOT NULL,
      anios           INT           NOT NULL DEFAULT 1,
      precio_unitario DECIMAL(18,2) NOT NULL,
      ingreso_mensual DECIMAL(18,2) NULL,
      ingreso_anual   DECIMAL(18,2) NULL,
      valor_total     DECIMAL(18,2) NULL,
      prob_cierre     DECIMAL(5,2)  NOT NULL DEFAULT 0,
      valor_ponderado DECIMAL(18,2) NULL,
      etapa           VARCHAR(30)   NULL,
      trimestre       VARCHAR(20)   NULL,
      mes_estimado    VARCHAR(20)   NULL,
      notas           TEXT          NULL,
      responsable     VARCHAR(200)  NULL,
      createdBy       VARCHAR(64)   NULL,
      createdAt       VARCHAR(40)   NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ]
  for (const ddl of tablas) await pool.query(ddl)
  // Migración: agregar columna responsable si la tabla ya existía sin ella.
  await pool.query(`ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS responsable VARCHAR(200) NULL`)
}
