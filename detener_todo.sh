#!/bin/bash

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  SCRIPT MAESTRO - DETENER TODO EL SISTEMA (RFID + FRONTEND + MEDICHAT)      ║
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
PID_FILE="$SCRIPT_DIR/.running_pids"

clear
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${RED}🛑 DETENIENDO SISTEMA COMPLETO${NC}                                              ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}     📦 Backend RFID de Gestión Médica                                        ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}     🖥️  Frontend React (Vite)                                                 ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}     💬 MediChat - Bot de WhatsApp                                            ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Función para matar proceso por PID
kill_process() {
    local pid=$1
    local name=$2
    
    if ps -p $pid > /dev/null 2>&1; then
        echo -e "${YELLOW}🛑 Deteniendo $name (PID: $pid)...${NC}"
        kill $pid 2>/dev/null
        sleep 1
        
        # Si aún está corriendo, forzar
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${YELLOW}   Forzando detención...${NC}"
            kill -9 $pid 2>/dev/null
            sleep 1
        fi
        
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${RED}   ❌ No se pudo detener $name${NC}"
            return 1
        else
            echo -e "${GREEN}   ✅ $name detenido${NC}"
            return 0
        fi
    else
        echo -e "${YELLOW}⚠️  $name no estaba corriendo (PID: $pid)${NC}"
        return 0
    fi
}

# Función para matar proceso por puerto
kill_port() {
    local port=$1
    local name=$2
    local pid=$(lsof -ti:$port 2>/dev/null)
    
    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}🛑 Deteniendo proceso en puerto $port ($name)...${NC}"
        kill -9 $pid 2>/dev/null
        sleep 1
        echo -e "${GREEN}   ✅ Puerto $port liberado${NC}"
    fi
}

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 BUSCANDO PROCESOS ACTIVOS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

PROCESSES_FOUND=0

# ═══════════════════════════════════════════════════════════════════════════════
# DETENER POR ARCHIVO DE PIDs
# ═══════════════════════════════════════════════════════════════════════════════

if [ -f "$PID_FILE" ]; then
    echo -e "${CYAN}📋 Leyendo PIDs guardados...${NC}"
    echo ""
    
    while IFS= read -r line; do
        name=$(echo $line | cut -d: -f1)
        pid=$(echo $line | cut -d: -f2)
        
        if [ ! -z "$pid" ]; then
            kill_process $pid $name
            PROCESSES_FOUND=$((PROCESSES_FOUND + 1))
        fi
    done < "$PID_FILE"
    
    # Limpiar archivo de PIDs
    > "$PID_FILE"
    echo ""
fi

# ═══════════════════════════════════════════════════════════════════════════════
# DETENER POR PUERTO (backup)
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔌 LIBERANDO PUERTOS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Puerto 3000 - Backend RFID
kill_port 3000 "Backend RFID"

# Puerto 5173 - Frontend Vite
kill_port 5173 "Frontend React"

# Puerto 5174 - Frontend Vite (alternativo)
kill_port 5174 "Frontend React Alt"

# Puerto 3001 - MediChat API
kill_port 3001 "MediChat API"

echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# DETENER PROCESOS NODE RELACIONADOS
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔎 BUSCANDO PROCESOS NODE RELACIONADOS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Buscar procesos de server_medical.js
RFID_PIDS=$(pgrep -f "server_medical.js" 2>/dev/null)
if [ ! -z "$RFID_PIDS" ]; then
    echo -e "${YELLOW}🛑 Deteniendo procesos server_medical.js...${NC}"
    for pid in $RFID_PIDS; do
        kill_process $pid "server_medical.js"
        PROCESSES_FOUND=$((PROCESSES_FOUND + 1))
    done
fi

# Buscar procesos de Vite
VITE_PIDS=$(pgrep -f "vite" 2>/dev/null)
if [ ! -z "$VITE_PIDS" ]; then
    echo -e "${YELLOW}🛑 Deteniendo procesos Vite (Frontend)...${NC}"
    for pid in $VITE_PIDS; do
        kill_process $pid "Vite"
        PROCESSES_FOUND=$((PROCESSES_FOUND + 1))
    done
fi

# Buscar procesos de MediChat/chatdex
MEDICHAT_PIDS=$(pgrep -f "medichat.*app.js\|chatdex.*app.js" 2>/dev/null)
if [ ! -z "$MEDICHAT_PIDS" ]; then
    echo -e "${YELLOW}🛑 Deteniendo procesos MediChat...${NC}"
    for pid in $MEDICHAT_PIDS; do
        kill_process $pid "MediChat"
        PROCESSES_FOUND=$((PROCESSES_FOUND + 1))
    done
fi

# Buscar cualquier proceso en el directorio medichat
MEDICHAT_DIR_PIDS=$(pgrep -f "/medichat/" 2>/dev/null)
if [ ! -z "$MEDICHAT_DIR_PIDS" ]; then
    echo -e "${YELLOW}🛑 Deteniendo procesos en directorio medichat...${NC}"
    for pid in $MEDICHAT_DIR_PIDS; do
        kill_process $pid "MediChat (dir)"
        PROCESSES_FOUND=$((PROCESSES_FOUND + 1))
    done
fi

# Buscar procesos en frontend/react
FRONTEND_PIDS=$(pgrep -f "frontend/react" 2>/dev/null)
if [ ! -z "$FRONTEND_PIDS" ]; then
    echo -e "${YELLOW}🛑 Deteniendo procesos del frontend...${NC}"
    for pid in $FRONTEND_PIDS; do
        kill_process $pid "Frontend"
        PROCESSES_FOUND=$((PROCESSES_FOUND + 1))
    done
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# VERIFICACIÓN FINAL
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}✅ VERIFICACIÓN FINAL${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verificar puertos
check_port_free() {
    if lsof -i:$1 >/dev/null 2>&1; then
        echo -e "${RED}⚠️  Puerto $1 aún en uso${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Puerto $1 liberado${NC}"
        return 0
    fi
}

check_port_free 3000
check_port_free 5173
check_port_free 3001

echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# RESUMEN
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
if [ $PROCESSES_FOUND -eq 0 ]; then
    echo -e "${CYAN}║${NC}  ${YELLOW}⚠️  No se encontraron procesos activos${NC}                                     ${CYAN}║${NC}"
else
    echo -e "${CYAN}║${NC}  ${GREEN}✅ SISTEMA DETENIDO CORRECTAMENTE${NC}                                          ${CYAN}║${NC}"
fi
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}🚀 Para iniciar nuevamente el sistema:${NC}"
echo -e "   ${YELLOW}./iniciar_todo.sh${NC}"
echo ""
echo -e "${BLUE}🗑️  Para eliminar sesión de WhatsApp:${NC}"
echo -e "   ${YELLOW}./eliminar_tokens_whatsapp.sh${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
