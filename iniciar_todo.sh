#!/bin/bash

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  SCRIPT MAESTRO - INICIAR TODO EL SISTEMA (RFID + FRONTEND + MEDICHAT)      ║
# ║  Para macOS                                                                   ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # Sin color

# Directorios
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RFID_DIR="$SCRIPT_DIR"
FRONTEND_DIR="$SCRIPT_DIR/frontend/react"
MEDICHAT_DIR="$SCRIPT_DIR/../medichat"

# Archivo de PIDs
PID_FILE="$SCRIPT_DIR/.running_pids"

clear
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${GREEN}🚀 INICIANDO SISTEMA COMPLETO${NC}                                               ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}     📦 Backend RFID de Gestión Médica                                        ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}     🖥️  Frontend React (Vite)                                                 ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}     💬 MediChat - Bot de WhatsApp                                            ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Función para verificar si un puerto está en uso
check_port() {
    lsof -i:$1 >/dev/null 2>&1
    return $?
}

# Función para matar proceso en un puerto
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}⚠️  Puerto $port en uso. Liberando...${NC}"
        kill -9 $pid 2>/dev/null
        sleep 1
    fi
}

# Limpiar PIDs anteriores
> "$PID_FILE"

# ═══════════════════════════════════════════════════════════════════════════════
# VERIFICACIONES PREVIAS
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 VERIFICACIONES PREVIAS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js no está instalado${NC}"
    echo "   Instala con: brew install node"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js instalado: $NODE_VERSION${NC}"

# Verificar npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm no está instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm instalado${NC}"

# Verificar MySQL
if ! command -v mysql &> /dev/null; then
    echo -e "${YELLOW}⚠️  MySQL CLI no encontrado (opcional)${NC}"
else
    echo -e "${GREEN}✅ MySQL CLI disponible${NC}"
fi

# Verificar directorios
if [ ! -d "$RFID_DIR/backend" ]; then
    echo -e "${RED}❌ Directorio backend RFID no encontrado: $RFID_DIR/backend${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Directorio Backend RFID encontrado${NC}"

if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${YELLOW}⚠️  Directorio Frontend no encontrado: $FRONTEND_DIR${NC}"
    FRONTEND_AVAILABLE=false
else
    echo -e "${GREEN}✅ Directorio Frontend React encontrado${NC}"
    FRONTEND_AVAILABLE=true
fi

if [ ! -d "$MEDICHAT_DIR" ]; then
    echo -e "${YELLOW}⚠️  Directorio MediChat no encontrado: $MEDICHAT_DIR${NC}"
    echo -e "${YELLOW}   El bot de WhatsApp no se iniciará${NC}"
    MEDICHAT_AVAILABLE=false
else
    echo -e "${GREEN}✅ Directorio MediChat encontrado${NC}"
    MEDICHAT_AVAILABLE=true
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# VERIFICAR DEPENDENCIAS
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📦 VERIFICANDO DEPENDENCIAS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verificar node_modules del backend RFID
if [ ! -d "$RFID_DIR/backend/node_modules" ]; then
    echo -e "${YELLOW}📥 Instalando dependencias del backend RFID...${NC}"
    cd "$RFID_DIR/backend"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Error instalando dependencias RFID${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Dependencias Backend RFID instaladas${NC}"
fi

# Verificar node_modules del frontend
if [ "$FRONTEND_AVAILABLE" = true ]; then
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        echo -e "${YELLOW}📥 Instalando dependencias del Frontend React...${NC}"
        cd "$FRONTEND_DIR"
        npm install
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Error instalando dependencias Frontend${NC}"
            FRONTEND_AVAILABLE=false
        fi
    else
        echo -e "${GREEN}✅ Dependencias Frontend React instaladas${NC}"
    fi
fi

# Verificar node_modules de MediChat
if [ "$MEDICHAT_AVAILABLE" = true ]; then
    if [ ! -d "$MEDICHAT_DIR/node_modules" ]; then
        echo -e "${YELLOW}📥 Instalando dependencias de MediChat...${NC}"
        cd "$MEDICHAT_DIR"
        npm install
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Error instalando dependencias MediChat${NC}"
            MEDICHAT_AVAILABLE=false
        fi
    else
        echo -e "${GREEN}✅ Dependencias MediChat instaladas${NC}"
    fi
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# LIBERAR PUERTOS SI ES NECESARIO
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔌 VERIFICANDO PUERTOS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Puerto 3000 - Backend RFID
if check_port 3000; then
    echo -e "${YELLOW}⚠️  Puerto 3000 en uso${NC}"
    read -p "¿Deseas liberarlo? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        kill_port 3000
        echo -e "${GREEN}✅ Puerto 3000 liberado${NC}"
    else
        echo -e "${RED}❌ No se puede continuar sin el puerto 3000${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Puerto 3000 disponible (Backend RFID)${NC}"
fi

# Puerto 5173 - Frontend Vite
if check_port 5173; then
    echo -e "${YELLOW}⚠️  Puerto 5173 en uso${NC}"
    read -p "¿Deseas liberarlo? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        kill_port 5173
        echo -e "${GREEN}✅ Puerto 5173 liberado${NC}"
    fi
else
    echo -e "${GREEN}✅ Puerto 5173 disponible (Frontend React)${NC}"
fi

# Puerto 3001 - MediChat (si está configurado en ese puerto)
if check_port 3001; then
    echo -e "${YELLOW}⚠️  Puerto 3001 en uso${NC}"
    read -p "¿Deseas liberarlo? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        kill_port 3001
        echo -e "${GREEN}✅ Puerto 3001 liberado${NC}"
    fi
else
    echo -e "${GREEN}✅ Puerto 3001 disponible (MediChat API)${NC}"
fi

echo ""

# Crear directorio de logs
mkdir -p "$RFID_DIR/logs"

# ═══════════════════════════════════════════════════════════════════════════════
# INICIAR BACKEND RFID
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📦 INICIANDO BACKEND RFID${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd "$RFID_DIR/backend"

# Crear archivo de log
LOG_RFID="$RFID_DIR/logs/rfid_$(date +%Y%m%d_%H%M%S).log"

echo -e "${CYAN}🚀 Iniciando servidor RFID en puerto 3000...${NC}"
nohup node server_medical.js > "$LOG_RFID" 2>&1 &
RFID_PID=$!
echo "rfid:$RFID_PID" >> "$PID_FILE"

# Esperar a que inicie
sleep 3

# Verificar que inició correctamente
if check_port 3000; then
    echo -e "${GREEN}✅ Backend RFID iniciado correctamente (PID: $RFID_PID)${NC}"
    echo -e "${GREEN}   📍 URL: https://localhost:3000${NC}"
    echo -e "${GREEN}   📄 Logs: $LOG_RFID${NC}"
else
    echo -e "${RED}❌ Error al iniciar el backend RFID${NC}"
    echo -e "${RED}   Revisa los logs: $LOG_RFID${NC}"
    cat "$LOG_RFID" | tail -20
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# INICIAR FRONTEND REACT
# ═══════════════════════════════════════════════════════════════════════════════

if [ "$FRONTEND_AVAILABLE" = true ]; then
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}🖥️  INICIANDO FRONTEND REACT${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    cd "$FRONTEND_DIR"
    
    # Crear archivo de log
    LOG_FRONTEND="$RFID_DIR/logs/frontend_$(date +%Y%m%d_%H%M%S).log"
    
    echo -e "${CYAN}🚀 Iniciando Frontend React en puerto 5173...${NC}"
    nohup npm run dev > "$LOG_FRONTEND" 2>&1 &
    FRONTEND_PID=$!
    echo "frontend:$FRONTEND_PID" >> "$PID_FILE"
    
    # Esperar a que inicie
    sleep 5
    
    # Verificar que inició correctamente
    if check_port 5173; then
        echo -e "${GREEN}✅ Frontend React iniciado correctamente (PID: $FRONTEND_PID)${NC}"
        echo -e "${GREEN}   📍 URL: https://localhost:5173${NC}"
        echo -e "${GREEN}   📄 Logs: $LOG_FRONTEND${NC}"
    else
        echo -e "${YELLOW}⚠️  Frontend puede estar iniciando...${NC}"
        echo -e "${YELLOW}   Revisa los logs: $LOG_FRONTEND${NC}"
    fi
    
    echo ""
fi

# ═══════════════════════════════════════════════════════════════════════════════
# INICIAR MEDICHAT
# ═══════════════════════════════════════════════════════════════════════════════

if [ "$MEDICHAT_AVAILABLE" = true ]; then
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}💬 INICIANDO MEDICHAT (BOT WHATSAPP)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    cd "$MEDICHAT_DIR"
    
    # Verificar .env
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            echo -e "${YELLOW}⚠️  Creando .env desde .env.example${NC}"
            cp .env.example .env
            echo -e "${YELLOW}   ⚠️  Recuerda configurar las variables en .env${NC}"
        else
            echo -e "${RED}❌ No se encontró .env ni .env.example${NC}"
            MEDICHAT_AVAILABLE=false
        fi
    fi
    
    if [ "$MEDICHAT_AVAILABLE" = true ]; then
        # Crear archivo de log
        LOG_MEDICHAT="$RFID_DIR/logs/medichat_$(date +%Y%m%d_%H%M%S).log"
        
        echo -e "${CYAN}🚀 Iniciando MediChat...${NC}"
        nohup node src/app.js > "$LOG_MEDICHAT" 2>&1 &
        MEDICHAT_PID=$!
        echo "medichat:$MEDICHAT_PID" >> "$PID_FILE"
        
        sleep 3
        
        if ps -p $MEDICHAT_PID > /dev/null 2>&1; then
            echo -e "${GREEN}✅ MediChat iniciado correctamente (PID: $MEDICHAT_PID)${NC}"
            echo -e "${GREEN}   📄 Logs: $LOG_MEDICHAT${NC}"
            echo ""
            echo -e "${YELLOW}📱 IMPORTANTE: Escanea el QR de WhatsApp${NC}"
            echo -e "${YELLOW}   1. Abre WhatsApp en tu teléfono${NC}"
            echo -e "${YELLOW}   2. Ve a: Configuración > Dispositivos vinculados${NC}"
            echo -e "${YELLOW}   3. Escanea el QR que aparece en los logs${NC}"
            echo ""
            echo -e "${CYAN}   Para ver el QR ejecuta: tail -f $LOG_MEDICHAT${NC}"
        else
            echo -e "${RED}❌ Error al iniciar MediChat${NC}"
            echo -e "${RED}   Revisa los logs: $LOG_MEDICHAT${NC}"
        fi
    fi
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# RESUMEN FINAL
# ═══════════════════════════════════════════════════════════════════════════════

# Obtener IP local para acceso desde móviles
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "No detectada")

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${GREEN}✅ SISTEMA INICIADO${NC}                                                        ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📍 URLs disponibles (desde esta computadora):${NC}"
echo -e "   • Backend RFID:     ${GREEN}https://localhost:3000${NC}"
echo -e "   • API Docs:         ${GREEN}https://localhost:3000/api-docs${NC}"
if [ "$FRONTEND_AVAILABLE" = true ]; then
echo -e "   • Frontend React:   ${GREEN}https://localhost:5173${NC}"
fi
echo ""
if [ "$LOCAL_IP" != "No detectada" ]; then
echo -e "${BLUE}📱 URLs para acceso desde MÓVIL (misma red WiFi):${NC}"
echo -e "   • Frontend React:   ${GREEN}https://$LOCAL_IP:5173${NC}"
echo -e "   • Backend API:      ${GREEN}https://$LOCAL_IP:3000${NC}"
echo ""
echo -e "${YELLOW}📷 PARA USAR RFID Y CÁMARA EN MÓVIL:${NC}"
echo -e "${YELLOW}   1. Abre https://$LOCAL_IP:5173 en tu navegador móvil${NC}"
echo -e "${YELLOW}   2. Acepta la advertencia del certificado del FRONTEND${NC}"
echo -e "${YELLOW}   3. Abre https://$LOCAL_IP:3000 y acepta también ese certificado${NC}"
echo -e "${YELLOW}   4. Vuelve al frontend y ya funcionará RFID y cámara${NC}"
echo ""
echo -e "${CYAN}💡 IMPORTANTE: El sistema detecta automáticamente la IP.${NC}"
echo -e "${CYAN}   Si cambias de red WiFi, solo reinicia el sistema.${NC}"
else
echo -e "${YELLOW}⚠️  No se pudo detectar la IP local automáticamente${NC}"
echo -e "${YELLOW}   Para acceso móvil, ejecuta: ipconfig getifaddr en0${NC}"
fi
echo ""
echo -e "${BLUE}📂 Archivos de log:${NC}"
echo -e "   • Logs:             ${CYAN}$RFID_DIR/logs/${NC}"
echo ""
echo -e "${BLUE}🛑 Para detener todo el sistema:${NC}"
echo -e "   ${YELLOW}./detener_todo.sh${NC}"
echo ""
echo -e "${BLUE}📊 Para ver logs en tiempo real:${NC}"
echo -e "   ${YELLOW}tail -f $RFID_DIR/logs/*.log${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Mostrar PIDs guardados
echo ""
echo -e "${CYAN}PIDs de procesos activos:${NC}"
cat "$PID_FILE" | while read line; do
    name=$(echo $line | cut -d: -f1)
    pid=$(echo $line | cut -d: -f2)
    echo -e "   • $name: $pid"
done
echo ""

# Preguntar si abrir el navegador
echo -e "${YELLOW}¿Deseas abrir el navegador? (s/n): ${NC}"
read -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    if [ "$FRONTEND_AVAILABLE" = true ]; then
        open "https://localhost:5173"
    else
        open "https://localhost:3000"
    fi
fi
