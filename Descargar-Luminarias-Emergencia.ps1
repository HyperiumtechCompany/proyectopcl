# Script: Descargar-Luminarias-Emergencia.ps1
# Propósito: Descargar LDT de luminarias de emergencia para DIALux
# Uso: .\Descargar-Luminarias-Emergencia.ps1

$destDir = "database\seeders\fixtures\luminaires-emergency"

# Crear carpeta si no existe
if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Descarga de Luminarias de Emergencia para DIALux            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$downloaded = 0
$failed = 0

# Función auxiliar para descargar
function Download-Ldt {
    param(
        [string]$url,
        [string]$filename
    )
    
    $filepath = Join-Path $destDir $filename
    
    if (Test-Path $filepath) {
        Write-Host "⏭️  Ya existe: $filename" -ForegroundColor Yellow
        return $true
    }
    
    Write-Host -NoNewline "⏳ Descargando: $filename... "
    
    try {
        Invoke-WebRequest -Uri $url -OutFile $filepath -ErrorAction Stop
        if ((Get-Item $filepath).Length -gt 0) {
            Write-Host "✅" -ForegroundColor Green
            return $true
        }
    }
    catch {
        Write-Host "❌ (URL no accesible)" -ForegroundColor Red
        Remove-Item -Path $filepath -ErrorAction SilentlyContinue
        return $false
    }
}

Write-Host "🔍 Buscando en fuentes públicas..." -ForegroundColor Cyan
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────
# Descargas automáticas (si están disponibles)
# ─────────────────────────────────────────────────────────────────────────

# Ejemplo: Thorlux RC18820 (ya deberías tener en fixtures/luminaires/)
$thorluxPath = "database\seeders\fixtures\luminaires\Thorlux-RC18820.ldt"
if (Test-Path $thorluxPath) {
    Write-Host "ℹ️  Thorlux RC18820 encontrada (se reutilizará para emergencia)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  DESCARGA MANUAL (RECOMENDADO)                                ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$instructions = @"
📌 DIALux Luminaire Finder (RECOMENDADO)
   Sitio: https://luminaires.dialux.com
   Pasos:
   1. Abre https://luminaires.dialux.com en tu navegador
   2. Filtra por:
      - Fabricante: Philips, LEDVANCE, Legrand, Thorlux
      - Tipo: "Emergency", "Exit Sign", "Anti-panic"
   3. Para cada producto encontrado:
      - Descarga el archivo LDT o IES
      - Guarda en: database\seeders\fixtures\luminaires-emergency\

📌 Fabricantes Directos
   - Philips: https://www.lighting.philips.com
   - LEDVANCE: https://www.ledvance.com
   - Legrand: https://www.legrand.com/en/lighting
   - Thorlux: https://www.thorlux.com/products/emergency

📌 Archivos esperados por categoría:

   ✓ SEÑALIZACIÓN DE SALIDA (EXIT Signs) - 3-5W, 250-350 lm:
     • Philips-Emergency-Exit-Sign.ldt
     • LEDVANCE-Emergency-Exit-Sign.ldt

   ✓ ANTIPÁNICO (20-50W, 1500-3000 lm):
     • Philips-Emergency-Compact-25W.ldt
     • LEDVANCE-Emergency-Bulkhead-30W.ldt
     • Zumtobel-Emergency-Pendant-20W.ldt

   ✓ CINTA DE PISO (1-2W, 100-200 lm):
     • Legrand-Emergency-Floor-Strip.ldt
     • Philips-Emergency-Route-Marking.ldt

📌 Después de descargar:

   1. Coloca todos los .ldt/ies en:
      database\seeders\fixtures\luminaires-emergency\

   2. Ejecuta el seeder:
      php artisan db:seed --class=EmergencyLuminaireSeeder

   3. Verifica que se importaron:
      php artisan tinker
      >>> `LuminaireProduct::where('fixture_type', 'like', '%emergency%')->get()`

   4. O verifica directamente en el navegador:
      http://proyectopcl.test (en la sección de luminarias)

"@

Write-Host $instructions

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════"
Write-Host ""

# Estado actual
Write-Host "📂 Carpeta de destino: $destDir" -ForegroundColor Gray
Write-Host "📊 Archivos descargados hasta ahora:"

if (Test-Path $destDir) {
    $files = Get-ChildItem -Path $destDir -Filter "*.ldt", "*.ies" 2>/dev/null | Sort-Object Name
    if ($files.Count -gt 0) {
        foreach ($file in $files) {
            $sizeKB = [Math]::Round($file.Length / 1KB, 1)
            Write-Host "   ✓ $($file.Name) ($sizeKB KB)" -ForegroundColor Green
        }
    }
    else {
        Write-Host "   (Sin archivos aún)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ Sigue los pasos de descarga manual arriba." -ForegroundColor Green
Write-Host ""
