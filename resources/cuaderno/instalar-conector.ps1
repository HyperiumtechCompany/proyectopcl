# Instalador del conector del Cuaderno de incidencias (Costos).
# Lo descarga instalar-conector-costos.cmd con un código de un solo uso.
# Instala en %LOCALAPPDATA%\CostosCuaderno (sin permisos de administrador) y lo deja
# iniciándose con Windows en segundo plano.
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = 'Tls12'

$servidor = '__SERVIDOR__'
$codigo = '__CODIGO__'
$nodeVersion = '__NODE__'

try {
    if (-not [Environment]::Is64BitOperatingSystem) {
        throw 'El conector necesita Windows 10 u 11 de 64 bits.'
    }
    $dir = Join-Path $env:LOCALAPPDATA 'CostosCuaderno'
    $app = Join-Path $dir 'app'
    $node = Join-Path $dir 'node\node.exe'
    New-Item -ItemType Directory -Force -Path $app | Out-Null
    $web = New-Object Net.WebClient
    $web.Encoding = [Text.Encoding]::UTF8

    if (-not (Test-Path $node)) {
        Write-Host 'Descargando Node.js (una sola vez, unos 30 MB)...'
        $zip = Join-Path $dir 'node.zip'
        $tmp = Join-Path $dir 'node-tmp'
        $web.DownloadFile("https://nodejs.org/dist/$nodeVersion/node-$nodeVersion-win-x64.zip", $zip)
        Expand-Archive -Path $zip -DestinationPath $tmp -Force
        Move-Item (Join-Path $tmp "node-$nodeVersion-win-x64") (Join-Path $dir 'node')
        Remove-Item $zip, $tmp -Recurse -Force
    }

    # Stop a previous copy so its files can be replaced.
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
        Where-Object { $_.CommandLine -like '*CostosCuaderno*cuaderno-agent.mjs*' } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

    Write-Host 'Descargando el conector...'
    $paquete = $web.DownloadString("$servidor/api/cuaderno-agente/paquete?codigo=$codigo") | ConvertFrom-Json
    $utf8 = New-Object Text.UTF8Encoding $false
    foreach ($archivo in $paquete.files.PSObject.Properties) {
        $destino = Join-Path $app $archivo.Name
        New-Item -ItemType Directory -Force -Path (Split-Path $destino) | Out-Null
        [IO.File]::WriteAllText($destino, $archivo.Value, $utf8)
    }
    [IO.File]::WriteAllText((Join-Path $app 'version.txt'), $paquete.version, $utf8)

    Write-Host 'Enlazando esta PC con tu cuenta de Costos...'
    $agente = Join-Path $app 'cuaderno-agent.mjs'
    & $node $agente --emparejar $codigo --servidor $servidor
    if ($LASTEXITCODE -ne 0) {
        throw 'No se pudo enlazar el conector. Genera un código nuevo en Costos y vuelve a intentar.'
    }

    # Starts with Windows, hidden (no console window).
    $inicio = Join-Path ([Environment]::GetFolderPath('Startup')) 'CostosCuaderno.vbs'
    $linea = 'CreateObject("WScript.Shell").Run """' + $node + '"" ""' + $agente + '""", 0, False'
    [IO.File]::WriteAllText($inicio, $linea, [Text.Encoding]::ASCII)
    Start-Process -FilePath 'wscript.exe' -ArgumentList ('"' + $inicio + '"')

    Write-Host ''
    Write-Host 'Listo. El conector quedó instalado y se inicia solo con Windows.' -ForegroundColor Green
    Write-Host 'Vuelve a Costos: la página detectará esta PC en unos segundos.'
} catch {
    Write-Host ''
    Write-Host ('No se pudo instalar: ' + $_.Exception.Message) -ForegroundColor Red
}
