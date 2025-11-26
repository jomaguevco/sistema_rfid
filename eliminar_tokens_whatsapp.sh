#!/bin/bash

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  ELIMINAR TOKENS WHATSAPP - BAILEYS SESSION                                  ║
# ║  Para macOS                                                                   ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # Sin color

# Directorio del script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

clear
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${RED}🗑️  ELIMINAR TOKENS WHATSAPP BUSINESS${NC}                                       ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Buscando carpetas de sesión de WhatsApp...${NC}"
echo ""

FOUND=false

# Función para eliminar carpeta
delete_folder() {
    local folder=$1
    local description=$2
    
    if [ -d "$folder" ]; then
        echo -e "${GREEN}✅ Carpeta encontrada: $description${NC}"
        echo -e "   📁 $folder"
        rm -rf "$folder"
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}   ✅ Eliminada correctamente${NC}"
            FOUND=true
        else
            echo -e "${RED}   ❌ Error al eliminar${NC}"
        fi
        echo ""
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# BUSCAR EN SISTEMA RFID
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📁 BUSCANDO EN SISTEMA RFID${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Ubicaciones en sistema_rfid
delete_folder "$SCRIPT_DIR/tokens/baileys-session" "tokens/baileys-session (raíz RFID)"
delete_folder "$SCRIPT_DIR/tokens" "tokens (raíz RFID)"
delete_folder "$SCRIPT_DIR/backend/tokens/baileys-session" "backend/tokens/baileys-session"
delete_folder "$SCRIPT_DIR/backend/tokens" "backend/tokens"
delete_folder "$SCRIPT_DIR/auth_info_baileys" "auth_info_baileys (raíz RFID)"
delete_folder "$SCRIPT_DIR/backend/auth_info_baileys" "backend/auth_info_baileys"

# ═══════════════════════════════════════════════════════════════════════════════
# BUSCAR EN MEDICHAT
# ═══════════════════════════════════════════════════════════════════════════════

MEDICHAT_DIR="$SCRIPT_DIR/../medichat"

if [ -d "$MEDICHAT_DIR" ]; then
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}💬 BUSCANDO EN MEDICHAT${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    delete_folder "$MEDICHAT_DIR/tokens/baileys-session" "medichat/tokens/baileys-session"
    delete_folder "$MEDICHAT_DIR/tokens" "medichat/tokens"
    delete_folder "$MEDICHAT_DIR/auth_info_baileys" "medichat/auth_info_baileys"
    delete_folder "$MEDICHAT_DIR/.wwebjs_auth" "medichat/.wwebjs_auth"
    delete_folder "$MEDICHAT_DIR/.wwebjs_cache" "medichat/.wwebjs_cache"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# BUSCAR EN DIRECTORIO PADRE
# ═══════════════════════════════════════════════════════════════════════════════

PARENT_DIR="$SCRIPT_DIR/.."

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📂 BUSCANDO EN DIRECTORIO PADRE${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

delete_folder "$PARENT_DIR/tokens/baileys-session" "tokens/baileys-session (directorio padre)"
delete_folder "$PARENT_DIR/tokens" "tokens (directorio padre)"

# ═══════════════════════════════════════════════════════════════════════════════
# BUSCAR ARCHIVOS .DATA.JSON DE WHATSAPP-WEB.JS
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 BUSCANDO ARCHIVOS DE SESIÓN ADICIONALES${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Buscar y eliminar carpetas .wwebjs en el directorio actual y medichat
for dir in "$SCRIPT_DIR" "$MEDICHAT_DIR" "$SCRIPT_DIR/backend"; do
    if [ -d "$dir" ]; then
        # Buscar carpetas que empiecen con .wwebjs
        find "$dir" -maxdepth 2 -type d -name ".wwebjs*" 2>/dev/null | while read -r folder; do
            echo -e "${GREEN}✅ Carpeta encontrada: $folder${NC}"
            rm -rf "$folder"
            echo -e "${GREEN}   ✅ Eliminada correctamente${NC}"
            FOUND=true
        done
        
        # Buscar carpetas session-*
        find "$dir" -maxdepth 2 -type d -name "session-*" 2>/dev/null | while read -r folder; do
            echo -e "${GREEN}✅ Carpeta de sesión encontrada: $folder${NC}"
            rm -rf "$folder"
            echo -e "${GREEN}   ✅ Eliminada correctamente${NC}"
            FOUND=true
        done
    fi
done

echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# RESUMEN
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
if [ "$FOUND" = true ]; then
    echo -e "${CYAN}║${NC}  ${GREEN}✅ TOKENS ELIMINADOS CORRECTAMENTE${NC}                                         ${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}La sesión de WhatsApp Business ha sido eliminada.${NC}"
    echo -e "${GREEN}Ahora puedes reiniciar el sistema y escanear el QR nuevamente.${NC}"
else
    echo -e "${CYAN}║${NC}  ${YELLOW}⚠️  NO SE ENCONTRARON CARPETAS DE TOKENS${NC}                                   ${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}No se encontraron carpetas de sesión de WhatsApp.${NC}"
    echo -e "${YELLOW}Es posible que ya hayan sido eliminadas o que nunca se crearon.${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 Ubicaciones verificadas:${NC}"
echo "   • tokens/baileys-session"
echo "   • tokens"
echo "   • backend/tokens/baileys-session"
echo "   • backend/tokens"
echo "   • auth_info_baileys"
echo "   • medichat/tokens"
echo "   • .wwebjs_auth"
echo "   • .wwebjs_cache"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Esperar que el usuario presione una tecla
read -p "Presiona Enter para continuar..." -n 1 -r
echo ""

