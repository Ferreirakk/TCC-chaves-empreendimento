# Servidor Chaves Treinamentos - Script de Inicializacao
# Execute este script se o .bat nao funcionar

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  Iniciando o Servidor Local - Chaves Treinamentos" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

# Procura o Node.js
$nodePaths = @(
    "C:\Program Files\nodejs\node.exe",
    "C:\Program Files (x86)\nodejs\node.exe",
    "$env:APPDATA\nvm\current\node.exe",
    "$env:LOCALAPPDATA\fnm\node.exe",
    "$env:USERPROFILE\nodejs\node.exe"
)

$nodeExe = $null

# Tenta pelo PATH primeiro
$nodeInPath = Get-Command node -ErrorAction SilentlyContinue
if ($nodeInPath) {
    $nodeExe = $nodeInPath.Source
} else {
    # Tenta caminhos comuns
    foreach ($p in $nodePaths) {
        if (Test-Path $p) {
            $nodeExe = $p
            $nodeDir = Split-Path $p
            $env:PATH = "$nodeDir;$env:PATH"
            break
        }
    }
    
    # Busca recursiva
    if (-not $nodeExe) {
        $found = Get-ChildItem "C:\Program Files" -Filter "node.exe" -Recurse -ErrorAction SilentlyContinue -Depth 2 | Select-Object -First 1
        if ($found) {
            $nodeExe = $found.FullName
            $nodeDir = Split-Path $found.FullName
            $env:PATH = "$nodeDir;$env:PATH"
        }
    }
}

if (-not $nodeExe) {
    Write-Host "ERRO: Node.js nao encontrado!" -ForegroundColor Red
    Write-Host "Instale com: winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
    Write-Host "Ou baixe em: https://nodejs.org" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host "[OK] Node.js encontrado: $nodeExe" -ForegroundColor Green
& $nodeExe --version
Write-Host ""

# Inicia o servidor
Set-Location $PSScriptRoot
Write-Host "Abrindo o painel no navegador..." -ForegroundColor Yellow
Start-Process "http://localhost:3000/index.html"
Write-Host ""

& $nodeExe server.js
