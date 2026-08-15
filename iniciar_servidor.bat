@echo off
title Servidor Chaves Treinamentos
echo =======================================================
echo   Iniciando o Servidor Local - Chaves Treinamentos
echo =======================================================
echo.

REM Prioridade 1: Node.js portatil na pasta do projeto
if exist "%~dp0node.exe" (
    echo [OK] Node.js portatil encontrado na pasta do projeto.
    "%~dp0node.exe" --version
    echo.
    echo Certifique-se de que os dispositivos estao na mesma rede
    echo do computador (Wi-Fi, Hotspot ou Ancoragem USB).
    echo.
    echo Abrindo o painel no navegador...
    start http://localhost:3000/index.html
    echo.
    "%~dp0node.exe" "%~dp0server.js"
    pause
    exit /b 0
)

REM Prioridade 2: Node.js instalado no sistema (PATH)
where node >nul 2>nul
if %ERRORLEVEL% == 0 (
    echo [OK] Node.js encontrado no sistema.
    node --version
    echo.
    echo Certifique-se de que os dispositivos estao na mesma rede
    echo do computador (Wi-Fi, Hotspot ou Ancoragem USB).
    echo.
    echo Abrindo o painel no navegador...
    start http://localhost:3000/index.html
    echo.
    node "%~dp0server.js"
    pause
    exit /b 0
)

REM Prioridade 3: Procura em caminhos comuns
set "NODE_PATHS=C:\Program Files\nodejs;C:\Program Files (x86)\nodejs"
for %%P in (%NODE_PATHS%) do (
    if exist "%%P\node.exe" (
        echo [OK] Node.js encontrado em: %%P
        "%%P\node.exe" --version
        echo.
        echo Abrindo o painel no navegador...
        start http://localhost:3000/index.html
        echo.
        "%%P\node.exe" "%~dp0server.js"
        pause
        exit /b 0
    )
)

echo.
echo ============================================================
echo   ERRO: Node.js nao foi encontrado!
echo.
echo   O arquivo node.exe deveria estar nesta mesma pasta.
echo   Caso nao esteja, instale o Node.js:
echo     - Via winget:  winget install OpenJS.NodeJS.LTS
echo     - Manual:      https://nodejs.org
echo ============================================================
echo.
pause
exit /b 1
