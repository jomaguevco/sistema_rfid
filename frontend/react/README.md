# Sistema Stock Médico RFID - Frontend React

## Instalación

```bash
cd frontend/react
npm install
```

## Desarrollo

```bash
npm run dev
```

El servidor de desarrollo se ejecutará en `http://localhost:5173`

## Producción

```bash
npm run build
```

Los archivos compilados estarán en `dist/`

## Estructura

- `src/pages/` - Páginas principales
- `src/components/` - Componentes reutilizables
- `src/hooks/` - Hooks personalizados (useRFID, etc.)
- `src/context/` - Contextos de React (Auth, Socket)
- `src/services/` - Servicios API

## Características

- Búsqueda unificada por RFID, código de barras, código interno o nombre
- Detección automática de RFID en todas las búsquedas
- Entrada/Salida de stock con manejo de cantidades
- Gestión de recetas con QR
- Roles: Admin y Farmacéutico

