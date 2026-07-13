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

    `CREATE TABLE IF NOT EXISTS rubros (
      id        VARCHAR(64)  NOT NULL PRIMARY KEY,
      nombre    VARCHAR(200) NOT NULL,
      createdAt VARCHAR(40)  NOT NULL,
      UNIQUE KEY uq_rubros_nombre (nombre)
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
      id                VARCHAR(64)   NOT NULL PRIMARY KEY,
      prospecto         VARCHAR(200)  NOT NULL,
      sector            VARCHAR(100)  NULL,
      tipo              VARCHAR(30)   NULL,
      producto_id       VARCHAR(64)   NULL,
      tipo_venta_id     VARCHAR(64)   NULL,
      descripcion       VARCHAR(300)  NULL,
      unidades          INT           NOT NULL,
      anios             INT           NOT NULL DEFAULT 1,
      precio_unitario   DECIMAL(18,2) NOT NULL,
      ingreso_mensual   DECIMAL(18,2) NULL,
      ingreso_anual     DECIMAL(18,2) NULL,
      valor_total       DECIMAL(18,2) NULL,
      prob_cierre       DECIMAL(5,2)  NOT NULL DEFAULT 0,
      valor_ponderado   DECIMAL(18,2) NULL,
      etapa             VARCHAR(30)   NULL,
      trimestre         VARCHAR(20)   NULL,
      mes_estimado      VARCHAR(20)   NULL,
      notas             TEXT          NULL,
      responsable       VARCHAR(200)  NULL,
      contacto_nombre   VARCHAR(200)  NULL,
      contacto_telefono VARCHAR(50)   NULL,
      fecha_cotizacion  VARCHAR(40)   NULL,
      proximo_paso      VARCHAR(300)  NULL,
      fecha_sig_paso    VARCHAR(40)   NULL,
      createdBy         VARCHAR(64)   NULL,
      createdAt         VARCHAR(40)   NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS universo (
      id               VARCHAR(64)  NOT NULL PRIMARY KEY,
      empresa          VARCHAR(200) NOT NULL,
      rubro            VARCHAR(200) NULL,
      segmento         VARCHAR(20)  NULL,
      contacto_nombre  VARCHAR(200) NULL,
      email            VARCHAR(320) NULL,
      telefono         VARCHAR(50)  NULL,
      telefono2        VARCHAR(50)  NULL,
      sitio_web        VARCHAR(300) NULL,
      linkedin         VARCHAR(300) NULL,
      tipo             VARCHAR(30)  NULL,
      responsable      VARCHAR(200) NULL,
      fecha_contacto   VARCHAR(40)  NULL,
      status_contacto  VARCHAR(30)  NOT NULL DEFAULT 'Sin contactar',
      etapa_pipeline   VARCHAR(30)  NOT NULL DEFAULT 'Universo',
      es_prospecto     TINYINT(1)   NOT NULL DEFAULT 0,
      observaciones    TEXT         NULL,
      createdAt        VARCHAR(40)  NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS prospectos_activos (
      id                 VARCHAR(64)  NOT NULL PRIMARY KEY,
      empresa            VARCHAR(200) NOT NULL,
      tipo               VARCHAR(30)  NULL,
      contacto_nombre    VARCHAR(200) NULL,
      telefono           VARCHAR(50)  NULL,
      telefono2          VARCHAR(50)  NULL,
      responsable        VARCHAR(200) NULL,
      fecha_1ra_reunion  VARCHAR(40)  NULL,
      status_1ra_reunion VARCHAR(30)  NULL,
      obs_1ra_reunion    TEXT         NULL,
      fecha_2da_reunion  VARCHAR(40)  NULL,
      status_2da_reunion VARCHAR(30)  NULL,
      obs_2da_reunion    TEXT         NULL,
      pide_cotizacion    TINYINT(1)   NOT NULL DEFAULT 0,
      pasa_forecast      TINYINT(1)   NOT NULL DEFAULT 0,
      createdAt          VARCHAR(40)  NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS reuniones (
      id           VARCHAR(64)  NOT NULL PRIMARY KEY,
      prospecto_id VARCHAR(64)  NOT NULL,
      numero       INT          NOT NULL DEFAULT 1,
      fecha        VARCHAR(40)  NOT NULL,
      status       VARCHAR(30)  NULL,
      observaciones TEXT        NULL,
      createdAt    VARCHAR(40)  NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ]
  for (const ddl of tablas) await pool.query(ddl)
  // Migraciones: columnas nuevas en tablas ya existentes.
  await pool.query(`ALTER TABLE universo ADD COLUMN IF NOT EXISTS es_prospecto TINYINT(1) NOT NULL DEFAULT 0`)
  await pool.query(`ALTER TABLE universo ADD COLUMN IF NOT EXISTS telefono2 VARCHAR(50) NULL`)
  await pool.query(`ALTER TABLE universo ADD COLUMN IF NOT EXISTS observaciones TEXT NULL`)
  await pool.query(`UPDATE universo SET status_contacto = 'Sin contactar' WHERE status_contacto = 'Sin contacto'`)
  await pool.query(`UPDATE universo SET segmento = 'Público' WHERE segmento = 'Gob.'`)
  await pool.query(`UPDATE universo SET tipo = 'Municipal' WHERE tipo = 'Municipio'`)
  await pool.query(`UPDATE universo SET tipo = 'Estatal' WHERE tipo = 'Gobierno estatal'`)
  await pool.query(`UPDATE prospectos_activos SET tipo = 'Municipal' WHERE tipo = 'Municipio'`)
  await pool.query(`UPDATE universo SET responsable = 'Alonso García' WHERE responsable = 'Alonso'`)
  await pool.query(`UPDATE prospectos_activos SET responsable = 'Alonso García' WHERE responsable = 'Alonso'`)
  await pool.query(`ALTER TABLE prospectos_activos ADD COLUMN IF NOT EXISTS telefono2 VARCHAR(50) NULL`)
  await pool.query(`ALTER TABLE ventas ADD COLUMN IF NOT EXISTS origen_tipo VARCHAR(20) NULL`)
  await pool.query(`ALTER TABLE ventas ADD COLUMN IF NOT EXISTS origen_id VARCHAR(64) NULL`)
  await pool.query(`ALTER TABLE ventas ADD COLUMN IF NOT EXISTS origen_nombre VARCHAR(200) NULL`)
  // Migrar reuniones existentes de prospectos_activos → tabla reuniones (idempotente)
  await pool.query(`
    INSERT IGNORE INTO reuniones (id, prospecto_id, numero, fecha, status, observaciones, createdAt)
    SELECT UUID(), id, 1, fecha_1ra_reunion, status_1ra_reunion, obs_1ra_reunion, createdAt
    FROM prospectos_activos
    WHERE fecha_1ra_reunion IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM reuniones r WHERE r.prospecto_id = prospectos_activos.id AND r.numero = 1)
  `)
  await pool.query(`
    INSERT IGNORE INTO reuniones (id, prospecto_id, numero, fecha, status, observaciones, createdAt)
    SELECT UUID(), id, 2, fecha_2da_reunion, status_2da_reunion, obs_2da_reunion, createdAt
    FROM prospectos_activos
    WHERE fecha_2da_reunion IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM reuniones r WHERE r.prospecto_id = prospectos_activos.id AND r.numero = 2)
  `)
  await pool.query(`ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS responsable VARCHAR(200) NULL`)
  await pool.query(`ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS tipo VARCHAR(30) NULL`)
  await pool.query(`ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS contacto_nombre VARCHAR(200) NULL`)
  await pool.query(`ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS contacto_telefono VARCHAR(50) NULL`)
  await pool.query(`ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS fecha_cotizacion VARCHAR(40) NULL`)
  await pool.query(`ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS proximo_paso VARCHAR(300) NULL`)
  await pool.query(`ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS fecha_sig_paso VARCHAR(40) NULL`)
  await pool.query(`ALTER TABLE unidades ADD COLUMN IF NOT EXISTS servicio VARCHAR(20) NULL`)
  await pool.query(`ALTER TABLE unidades ADD COLUMN IF NOT EXISTS nombre_largo VARCHAR(200) NULL`)
}
