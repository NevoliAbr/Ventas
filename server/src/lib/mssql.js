// Conexión compartida a Microsoft SQL Server + creación del esquema.
// Tanto los usuarios como el catálogo de ventas usan este mismo pool.
import sql from 'mssql'

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'nevoli123',
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_NAME || 'Base_ventas',
  options: { trustServerCertificate: true, enableArithAbort: true },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
}

let poolPromise = null

export function getPool() {
  if (!poolPromise) {
    poolPromise = sql
      .connect(config)
      .then(async (pool) => {
        await ensureSchema(pool)
        console.log(`[db] Conectado a SQL Server: ${config.server}:${config.port}/${config.database}`)
        return pool
      })
      .catch((e) => {
        poolPromise = null // permite reintentar
        throw e
      })
  }
  return poolPromise
}

// Crea las tablas si no existen (idempotente).
async function ensureSchema(pool) {
  // Usuarios
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
    CREATE TABLE users (
      id           NVARCHAR(64)  NOT NULL PRIMARY KEY,
      nombre       NVARCHAR(200) NOT NULL,
      email        NVARCHAR(320) NOT NULL UNIQUE,
      password     NVARCHAR(255) NOT NULL,
      role         NVARCHAR(20)  NOT NULL CONSTRAINT DF_users_role DEFAULT 'user',
      facultades   NVARCHAR(MAX) NULL,
      resetToken   NVARCHAR(128) NULL,
      resetExpires BIGINT        NULL,
      createdAt    NVARCHAR(40)  NOT NULL
    )`)
  // Por si la tabla users existía sin la columna facultades:
  await pool.request().query(`IF COL_LENGTH('users','facultades') IS NULL ALTER TABLE users ADD facultades NVARCHAR(MAX) NULL`)

  // Catálogo: unidades de medida
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='unidades' AND xtype='U')
    CREATE TABLE unidades (
      id          NVARCHAR(64)  NOT NULL PRIMARY KEY,
      nombre      NVARCHAR(100) NOT NULL,
      abreviatura NVARCHAR(20)  NULL
    )`)

  // Catálogo: clientes
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='clientes' AND xtype='U')
    CREATE TABLE clientes (
      id       NVARCHAR(64)  NOT NULL PRIMARY KEY,
      nombre   NVARCHAR(200) NOT NULL,
      email    NVARCHAR(320) NULL,
      telefono NVARCHAR(50)  NULL
    )`)

  // Catálogo: productos / servicios
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='productos' AND xtype='U')
    CREATE TABLE productos (
      id        NVARCHAR(64)  NOT NULL PRIMARY KEY,
      nombre    NVARCHAR(200) NOT NULL,
      tipo      NVARCHAR(20)  NOT NULL,
      sector    NVARCHAR(100) NULL,
      unidad_id NVARCHAR(64)  NULL,
      activo    BIT           NOT NULL CONSTRAINT DF_prod_activo DEFAULT 1,
      createdAt NVARCHAR(40)  NOT NULL
    )`)
  await pool.request().query(`IF COL_LENGTH('productos','sector') IS NULL ALTER TABLE productos ADD sector NVARCHAR(100) NULL`)

  // Catálogo: rangos de precio por producto. Cada rango = [unidades_min, unidades_max]
  // (unidades_max NULL = "más de") con precio_piso (mínimo) y precio_lista (referencia),
  // por unidad/mes. Al cotizar: mensual = precio × unidades, anual = ×12, total = anual × años.
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tipos_venta' AND xtype='U')
    CREATE TABLE tipos_venta (
      id           NVARCHAR(64)  NOT NULL PRIMARY KEY,
      producto_id  NVARCHAR(64)  NOT NULL,
      nombre       NVARCHAR(200) NOT NULL,
      segmento     NVARCHAR(200) NULL,
      unidades_min INT           NOT NULL CONSTRAINT DF_tv_umin  DEFAULT 1,
      unidades_max INT           NULL,
      precio_piso  DECIMAL(18,2) NOT NULL CONSTRAINT DF_tv_piso  DEFAULT 0,
      precio_lista DECIMAL(18,2) NOT NULL CONSTRAINT DF_tv_lista DEFAULT 0
    )`)
  await pool.request().query(`IF COL_LENGTH('unidades','servicio') IS NULL ALTER TABLE unidades ADD servicio NVARCHAR(20) NULL`)
  await pool.request().query(`IF COL_LENGTH('unidades','nombre_largo') IS NULL ALTER TABLE unidades ADD nombre_largo NVARCHAR(200) NULL`)
  await pool.request().query(`IF COL_LENGTH('tipos_venta','segmento') IS NULL ALTER TABLE tipos_venta ADD segmento NVARCHAR(200) NULL`)
  // Migración de modelos anteriores -> rangos (piso/lista).
  for (const cons of ['DF_tv_min', 'DF_tv_cant', 'DF_tv_pmin', 'DF_tv_pmax']) {
    await pool.request().query(`IF OBJECT_ID('${cons}','D') IS NOT NULL ALTER TABLE tipos_venta DROP CONSTRAINT ${cons}`)
  }
  for (const col of ['minimo', 'modalidad', 'cantidad', 'precio_min', 'precio_max']) {
    await pool.request().query(`IF COL_LENGTH('tipos_venta','${col}') IS NOT NULL ALTER TABLE tipos_venta DROP COLUMN ${col}`)
  }
  await pool.request().query(`IF COL_LENGTH('tipos_venta','unidades_min') IS NULL ALTER TABLE tipos_venta ADD unidades_min INT NOT NULL CONSTRAINT DF_tv_umin DEFAULT 1`)
  await pool.request().query(`IF COL_LENGTH('tipos_venta','unidades_max') IS NULL ALTER TABLE tipos_venta ADD unidades_max INT NULL`)
  await pool.request().query(`IF COL_LENGTH('tipos_venta','precio_piso') IS NULL ALTER TABLE tipos_venta ADD precio_piso DECIMAL(18,2) NOT NULL CONSTRAINT DF_tv_piso DEFAULT 0`)
  await pool.request().query(`IF COL_LENGTH('tipos_venta','precio_lista') IS NULL ALTER TABLE tipos_venta ADD precio_lista DECIMAL(18,2) NOT NULL CONSTRAINT DF_tv_lista DEFAULT 0`)

  // Ventas / Cotizaciones (transacciones)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ventas' AND xtype='U')
    CREATE TABLE ventas (
      id         NVARCHAR(64)  NOT NULL PRIMARY KEY,
      folio      NVARCHAR(40)  NULL,
      cliente_id NVARCHAR(64)  NULL,
      fecha      NVARCHAR(40)  NOT NULL,
      notas      NVARCHAR(MAX) NULL,
      total      DECIMAL(18,2) NOT NULL CONSTRAINT DF_ventas_total DEFAULT 0,
      createdBy  NVARCHAR(64)  NULL,
      createdAt  NVARCHAR(40)  NOT NULL
    )`)
  // Por si la tabla ventas existía sin la columna folio:
  await pool.request().query(`IF COL_LENGTH('ventas','folio') IS NULL ALTER TABLE ventas ADD folio NVARCHAR(40) NULL`)
  await pool.request().query(`IF COL_LENGTH('ventas','origen_tipo') IS NULL ALTER TABLE ventas ADD origen_tipo NVARCHAR(20) NULL`)
  await pool.request().query(`IF COL_LENGTH('ventas','origen_id') IS NULL ALTER TABLE ventas ADD origen_id NVARCHAR(64) NULL`)
  await pool.request().query(`IF COL_LENGTH('ventas','origen_nombre') IS NULL ALTER TABLE ventas ADD origen_nombre NVARCHAR(200) NULL`)

  // Líneas de cada cotización (snapshot). cantidad = unidades; precio_unitario = $/unidad/mes;
  // ingreso_mensual = precio × unidades; ingreso_anual = ×12; subtotal = anual × anios.
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='venta_items' AND xtype='U')
    CREATE TABLE venta_items (
      id              NVARCHAR(64)  NOT NULL PRIMARY KEY,
      venta_id        NVARCHAR(64)  NOT NULL,
      producto_id     NVARCHAR(64)  NULL,
      tipo_venta_id   NVARCHAR(64)  NULL,
      descripcion     NVARCHAR(300) NULL,
      unidad          NVARCHAR(50)  NULL,
      cantidad        DECIMAL(18,2) NOT NULL,
      anios           INT           NULL,
      precio_unitario DECIMAL(18,2) NOT NULL,
      ingreso_mensual DECIMAL(18,2) NULL,
      ingreso_anual   DECIMAL(18,2) NULL,
      subtotal        DECIMAL(18,2) NOT NULL
    )`)
  // Migración: quitar modalidad; agregar anios, ingreso_mensual, ingreso_anual.
  await pool.request().query(`IF COL_LENGTH('venta_items','modalidad') IS NOT NULL ALTER TABLE venta_items DROP COLUMN modalidad`)
  await pool.request().query(`IF COL_LENGTH('venta_items','anios') IS NULL ALTER TABLE venta_items ADD anios INT NULL`)
  await pool.request().query(`IF COL_LENGTH('venta_items','ingreso_mensual') IS NULL ALTER TABLE venta_items ADD ingreso_mensual DECIMAL(18,2) NULL`)
  await pool.request().query(`IF COL_LENGTH('venta_items','ingreso_anual') IS NULL ALTER TABLE venta_items ADD ingreso_anual DECIMAL(18,2) NULL`)

  // Pipeline / Forecast: oportunidades de venta.
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='oportunidades' AND xtype='U')
    CREATE TABLE oportunidades (
      id              NVARCHAR(64)  NOT NULL PRIMARY KEY,
      prospecto       NVARCHAR(200) NOT NULL,
      sector          NVARCHAR(100) NULL,
      producto_id     NVARCHAR(64)  NULL,
      tipo_venta_id   NVARCHAR(64)  NULL,
      descripcion     NVARCHAR(300) NULL,
      unidades        INT           NOT NULL,
      anios           INT           NOT NULL CONSTRAINT DF_op_anios DEFAULT 1,
      precio_unitario DECIMAL(18,2) NOT NULL,
      ingreso_mensual DECIMAL(18,2) NULL,
      ingreso_anual   DECIMAL(18,2) NULL,
      valor_total     DECIMAL(18,2) NULL,
      prob_cierre     DECIMAL(5,2)  NOT NULL CONSTRAINT DF_op_prob DEFAULT 0,
      valor_ponderado DECIMAL(18,2) NULL,
      etapa           NVARCHAR(30)  NULL,
      trimestre       NVARCHAR(10)  NULL,
      mes_estimado    NVARCHAR(20)  NULL,
      notas             NVARCHAR(MAX) NULL,
      responsable       NVARCHAR(200) NULL,
      tipo              NVARCHAR(30)  NULL,
      contacto_nombre   NVARCHAR(200) NULL,
      contacto_telefono NVARCHAR(50)  NULL,
      fecha_cotizacion  NVARCHAR(40)  NULL,
      proximo_paso      NVARCHAR(300) NULL,
      fecha_sig_paso    NVARCHAR(40)  NULL,
      createdBy         NVARCHAR(64)  NULL,
      createdAt         NVARCHAR(40)  NOT NULL
    )`)
  await pool.request().query(`IF COL_LENGTH('universo','es_prospecto') IS NULL ALTER TABLE universo ADD es_prospecto BIT NOT NULL CONSTRAINT DF_uni_esp DEFAULT 0`)
  await pool.request().query(`IF COL_LENGTH('oportunidades','responsable') IS NULL ALTER TABLE oportunidades ADD responsable NVARCHAR(200) NULL`)
  await pool.request().query(`IF COL_LENGTH('oportunidades','tipo') IS NULL ALTER TABLE oportunidades ADD tipo NVARCHAR(30) NULL`)
  await pool.request().query(`IF COL_LENGTH('oportunidades','contacto_nombre') IS NULL ALTER TABLE oportunidades ADD contacto_nombre NVARCHAR(200) NULL`)
  await pool.request().query(`IF COL_LENGTH('oportunidades','contacto_telefono') IS NULL ALTER TABLE oportunidades ADD contacto_telefono NVARCHAR(50) NULL`)
  await pool.request().query(`IF COL_LENGTH('oportunidades','fecha_cotizacion') IS NULL ALTER TABLE oportunidades ADD fecha_cotizacion NVARCHAR(40) NULL`)
  await pool.request().query(`IF COL_LENGTH('oportunidades','proximo_paso') IS NULL ALTER TABLE oportunidades ADD proximo_paso NVARCHAR(300) NULL`)
  await pool.request().query(`IF COL_LENGTH('oportunidades','fecha_sig_paso') IS NULL ALTER TABLE oportunidades ADD fecha_sig_paso NVARCHAR(40) NULL`)

  // Universo de prospectos
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='universo' AND xtype='U')
    CREATE TABLE universo (
      id               NVARCHAR(64)  NOT NULL PRIMARY KEY,
      empresa          NVARCHAR(200) NOT NULL,
      rubro            NVARCHAR(200) NULL,
      segmento         NVARCHAR(20)  NULL,
      contacto_nombre  NVARCHAR(200) NULL,
      email            NVARCHAR(320) NULL,
      telefono         NVARCHAR(50)  NULL,
      telefono2        NVARCHAR(50)  NULL,
      sitio_web        NVARCHAR(300) NULL,
      linkedin         NVARCHAR(300) NULL,
      tipo             NVARCHAR(30)  NULL,
      responsable      NVARCHAR(200) NULL,
      fecha_contacto   NVARCHAR(40)  NULL,
      status_contacto  NVARCHAR(30)  NOT NULL CONSTRAINT DF_uni_status DEFAULT 'Sin contactar',
      etapa_pipeline   NVARCHAR(30)  NOT NULL CONSTRAINT DF_uni_etapa  DEFAULT 'Universo',
      es_prospecto     BIT           NOT NULL CONSTRAINT DF_uni_esp    DEFAULT 0,
      createdAt        NVARCHAR(40)  NOT NULL
    )`)
  await pool.request().query(`IF COL_LENGTH('universo','telefono2') IS NULL ALTER TABLE universo ADD telefono2 NVARCHAR(50) NULL`)
  await pool.request().query(`UPDATE universo SET status_contacto = 'Sin contactar' WHERE status_contacto = 'Sin contacto'`)
  await pool.request().query(`UPDATE universo SET segmento = 'Público' WHERE segmento = 'Gob.'`)
  await pool.request().query(`UPDATE universo SET tipo = 'Municipal' WHERE tipo = 'Municipio'`)
  await pool.request().query(`UPDATE universo SET tipo = 'Estatal' WHERE tipo = 'Gobierno estatal'`)
  await pool.request().query(`UPDATE prospectos_activos SET tipo = 'Municipal' WHERE tipo = 'Municipio'`)
  await pool.request().query(`UPDATE universo SET responsable = 'Alonso García' WHERE responsable = 'Alonso'`)
  await pool.request().query(`UPDATE prospectos_activos SET responsable = 'Alonso García' WHERE responsable = 'Alonso'`)

  // Prospectos activos (reuniones)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='prospectos_activos' AND xtype='U')
    CREATE TABLE prospectos_activos (
      id                 NVARCHAR(64)  NOT NULL PRIMARY KEY,
      empresa            NVARCHAR(200) NOT NULL,
      tipo               NVARCHAR(30)  NULL,
      contacto_nombre    NVARCHAR(200) NULL,
      telefono           NVARCHAR(50)  NULL,
      telefono2          NVARCHAR(50)  NULL,
      responsable        NVARCHAR(200) NULL,
      fecha_1ra_reunion  NVARCHAR(40)  NULL,
      status_1ra_reunion NVARCHAR(30)  NULL,
      obs_1ra_reunion    NVARCHAR(MAX) NULL,
      fecha_2da_reunion  NVARCHAR(40)  NULL,
      status_2da_reunion NVARCHAR(30)  NULL,
      obs_2da_reunion    NVARCHAR(MAX) NULL,
      pide_cotizacion    BIT           NOT NULL CONSTRAINT DF_pr_pide  DEFAULT 0,
      pasa_forecast      BIT           NOT NULL CONSTRAINT DF_pr_pasa  DEFAULT 0,
      createdAt          NVARCHAR(40)  NOT NULL
    )`)
  await pool.request().query(`IF COL_LENGTH('prospectos_activos','telefono2') IS NULL ALTER TABLE prospectos_activos ADD telefono2 NVARCHAR(50) NULL`)

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='reuniones' AND xtype='U')
    CREATE TABLE reuniones (
      id           NVARCHAR(64)  NOT NULL PRIMARY KEY,
      prospecto_id NVARCHAR(64)  NOT NULL,
      numero       INT           NOT NULL CONSTRAINT DF_reu_num DEFAULT 1,
      fecha        NVARCHAR(40)  NOT NULL,
      status       NVARCHAR(30)  NULL,
      observaciones NVARCHAR(MAX) NULL,
      createdAt    NVARCHAR(40)  NOT NULL
    )`)

  // Migrar reuniones existentes (idempotente)
  await pool.request().query(`
    INSERT INTO reuniones (id, prospecto_id, numero, fecha, status, observaciones, createdAt)
    SELECT NEWID(), id, 1, fecha_1ra_reunion, status_1ra_reunion, obs_1ra_reunion, createdAt
    FROM prospectos_activos
    WHERE fecha_1ra_reunion IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM reuniones r WHERE r.prospecto_id = prospectos_activos.id AND r.numero = 1)
  `)
  await pool.request().query(`
    INSERT INTO reuniones (id, prospecto_id, numero, fecha, status, observaciones, createdAt)
    SELECT NEWID(), id, 2, fecha_2da_reunion, status_2da_reunion, obs_2da_reunion, createdAt
    FROM prospectos_activos
    WHERE fecha_2da_reunion IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM reuniones r WHERE r.prospecto_id = prospectos_activos.id AND r.numero = 2)
  `)
}

export { sql }
