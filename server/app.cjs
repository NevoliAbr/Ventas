// Punto de entrada CommonJS para Phusion Passenger.
// Passenger usa require() que no puede cargar ES Modules directamente.
// Este wrapper CJS usa import() dinámico para cargar el módulo ESM principal.
import('./src/index.js').catch((err) => {
  console.error('[startup] Error fatal al cargar la app:', err);
  process.exit(1);
});
