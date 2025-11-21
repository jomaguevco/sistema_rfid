# Instrucciones para Usar el Sistema React

## Correcciones Aplicadas

### 1. Errores Corregidos
- ✅ Agregados casos faltantes en `showSection` para `prescriptions`, `stock-entry`, `stock-exit`
- ✅ Creados modales faltantes: `exitListeningModal`, `entryListeningModal`, `quantityEntryModal`, `quantityExitModal`
- ✅ Implementada función `loadPrescriptions()` y exportada globalmente
- ✅ Eliminado rol "despacho" - solo Admin y Farmacéutico

### 2. Sistema React Creado
- ✅ Proyecto React con Vite configurado
- ✅ Estructura de carpetas completa
- ✅ Contextos: AuthContext, SocketContext
- ✅ Hook useRFID para detección automática
- ✅ Páginas: Login, Dashboard, Products, Prescriptions, StockEntry, StockExit

## Cómo Usar

### Opción 1: Sistema Actual (HTML/JS) - Corregido
1. El sistema actual ya tiene las correcciones aplicadas
2. Las recetas deberían cargar correctamente
3. Los botones de RFID deberían funcionar

### Opción 2: Sistema React (Nuevo)
1. Ir a `frontend/react`
2. Ejecutar `npm install` (ya hecho)
3. Ejecutar `npm run dev`
4. Abrir `http://localhost:5173`
5. El sistema React tiene todas las funcionalidades mejoradas

## Roles

- **Admin**: Acceso completo
- **Farmacéutico**: Puede ver recetas, despachar, entrada/salida de stock

## Funcionalidades RFID

- **Búsqueda**: Detecta RFID automáticamente en todas las búsquedas
- **Entrada Stock**: Escucha RFID, detecta si es caja y pide cantidad
- **Salida Stock**: Escucha RFID, detecta si es caja y pide cantidad
- **Recetas**: Puede buscar recetas por código o QR (escaneable)

## Próximos Pasos

1. Probar el sistema actual corregido
2. Si funciona, migrar gradualmente a React
3. Si hay problemas, reportarlos para corregirlos

