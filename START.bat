@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Rupture Planner

rem Work from the project folder, including paths containing spaces.
pushd "%~dp0"
if errorlevel 1 (
    echo [ERROR] Cannot open the project folder.
    pause
    exit /b 1
)

if /I "%~1"=="--run" goto run

rem Keep first-time setup and prerequisite errors visible before minimizing.
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js was not found. Install Node.js from https://nodejs.org
    echo Use Node.js 22.18+ in the 22.x series, or 24.11+.
    echo Then close this window and double-click START.bat again.
    goto failed
)

rem Match the Node.js versions required by the project's Uklad dependencies.
node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit((major === 22 && minor >= 18 || major === 24 && minor >= 11 || major > 24) ? 0 : 1)"
if errorlevel 1 (
    echo [ERROR] This project requires Node.js 22.18+ in the 22.x series, or 24.11+.
    echo Install a supported version from https://nodejs.org and try again.
    goto failed
)

call npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm was not found. Reinstall Node.js with npm included.
    goto failed
)

rem Also retry setup when a previous install did not create the Vite launcher.
if not exist "node_modules\.bin\vite.cmd" (
    echo [INFO] Installing dependencies from package-lock.json. Internet access is required.
    call npm ci --include=dev
    if errorlevel 1 (
        echo [ERROR] Dependency installation failed. Check the output above and try again.
        goto failed
    )
)

rem Leave the server in its own minimized window after setup succeeds.
start "Rupture Planner" /min "%ComSpec%" /d /v:off /s /c ""%~f0" --run"
if errorlevel 1 goto failed
popd
exit /b 0

:run
echo [INFO] Starting Rupture Planner at http://localhost:5173
echo [INFO] Close this window to stop the planner. Closing the browser does not stop it.
rem A stable port preserves access to browser-saved plans on subsequent launches.
call npm run dev -- --open --host localhost --port 5173 --strictPort
if errorlevel 1 (
    echo [ERROR] The planner could not run. Check the output above.
    echo If port 5173 is in use, close the existing server before trying again.
    goto failed
)
popd
exit /b 0

:failed
echo.
pause
popd
exit /b 1
