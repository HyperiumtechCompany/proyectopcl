#!/bin/bash

###############################################################################
# Script: descargar-luminarias-emergencia.sh
# Propósito: Descargar LDT de luminarias de emergencia desde fuentes autorizadas
# Uso: bash descargar-luminarias-emergencia.sh
###############################################################################

set -e

DEST_DIR="database/seeders/fixtures/luminaires-emergency"

# Crear carpeta si no existe
mkdir -p "$DEST_DIR"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Descarga de Luminarias de Emergencia para DIALux            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Contador de descargadas
DOWNLOADED=0
FAILED=0

# ─────────────────────────────────────────────────────────────────────────
# OPCIÓN 1: Descargas automáticas (si están disponibles públicamente)
# NOTA: Estos son ejemplos. Algunos URLs pueden no funcionar directamente.
# ─────────────────────────────────────────────────────────────────────────

echo "📥 Intentando descargas automáticas..."
echo ""

# Función auxiliar para descargar
download_ldt() {
    local url="$1"
    local filename="$2"
    local filepath="$DEST_DIR/$filename"
    
    if [ -f "$filepath" ]; then
        echo "⏭️  Ya existe: $filename"
        return 0
    fi
    
    echo -n "⏳ Descargando: $filename... "
    
    if curl -s -L -o "$filepath" "$url" 2>/dev/null && [ -s "$filepath" ]; then
        echo "✅"
        ((DOWNLOADED++))
        return 0
    else
        echo "❌ (URL no accesible o servidor no disponible)"
        rm -f "$filepath"
        ((FAILED++))
        return 1
    fi
}

# Ejemplos de URLs de DIALux Luminaire Finder
# NOTA: Estos son URLs hipotéticos — verificar disponibilidad real en luminaires.dialux.com

echo "🔍 Buscando en fuentes públicas..."
echo ""

# Intenta descargar Thorlux (ya deberías tener RC18820)
if [ ! -f "$DEST_DIR/Thorlux-RC18820.ldt" ]; then
    echo "ℹ️  Thorlux RC18820 — debería estar en fixtures/luminaires/"
    echo "    Se usará como base para emergencia (ver EmergencyLuminaireSeeder)"
    echo ""
fi

# ─────────────────────────────────────────────────────────────────────────
# OPCIÓN 2: Descarga MANUAL (más confiable)
# ─────────────────────────────────────────────────────────────────────────

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  DESCARGA MANUAL (RECOMENDADO)                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

cat << 'EOF'
Por favor, descarga manualmente los archivos LDT desde estas fuentes:

📌 DIALux Luminaire Finder (RECOMENDADO)
   Sitio: https://luminaires.dialux.com
   Pasos:
   1. Ir a https://luminaires.dialux.com
   2. Filtrar por:
      - Fabricante: Philips, LEDVANCE, Legrand, Thorlux
      - Tipo: "Emergency", "Exit Sign", "Anti-panic"
   3. Para cada producto:
      - Hacer click en "Download LDT" o "Download IES"
      - Guardar en: database/seeders/fixtures/luminaires-emergency/

📌 Fabricantes Directos
   - Philips Safety & Security:  https://www.lighting.philips.com
   - LEDVANCE Emergency:        https://www.ledvance.com
   - Legrand Lighting:          https://www.legrand.com/en/lighting
   - Thorlux Emergency:         https://www.thorlux.com/products/emergency

📌 Archivos esperados:

   ✓ Señalización de Salida (EXIT Signs):
     - Philips-Emergency-Exit-Sign.ldt (300 lm, 3.2W)
     - LEDVANCE-Emergency-Exit-Sign.ldt (300 lm, 4W)

   ✓ Antipánico (20-50W, 1500-3000 lm):
     - Philips-Emergency-Compact-25W.ldt (2300 lm, 25W)
     - LEDVANCE-Emergency-Bulkhead-30W.ldt (2600 lm, 30W)
     - Zumtobel-Emergency-Pendant-20W.ldt (2100 lm, 20W)

   ✓ Cinta de Piso (1-2W, 100-200 lm):
     - Legrand-Emergency-Floor-Strip.ldt (120 lm, 1.2W)
     - Philips-Emergency-Route-Marking.ldt (150 lm, 1.5W)

📌 Una vez descargados:
   - Coloca todos los .ldt en: database/seeders/fixtures/luminaires-emergency/
   - Ejecuta: php artisan db:seed --class=EmergencyLuminaireSeeder
   - Verifica: php artisan tinker
     > LuminaireProduct::where('fixture_type', 'like', '%emergency%')->get()

EOF

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Resultado
if [ $DOWNLOADED -gt 0 ]; then
    echo "✅ Se descargaron $DOWNLOADED archivo(s)"
fi

if [ $FAILED -gt 0 ]; then
    echo "⚠️  $FAILED descarga(s) fallaron (probablemente requieren descarga manual)"
fi

echo ""
echo "📂 Carpeta de destino: $DEST_DIR"
echo "📊 Archivos actuales:"
ls -lh "$DEST_DIR" 2>/dev/null || echo "   (Carpeta vacía o no existe aún)"

echo ""
echo "✅ Script completado. Sigue los pasos manuales arriba."
echo ""

EOF
