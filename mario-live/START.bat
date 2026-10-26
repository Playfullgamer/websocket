@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Mario Live - TikTok
color 0F

echo.
echo   ==============================================
echo        MARIO LIVE  -  TikTok AI Mario + Luigi
echo   ==============================================
echo.

rem ------------------------------------------------------------
rem  1. Python 3.10+
rem ------------------------------------------------------------
set "PY="
call :find_python
if not defined PY (
    echo [setup] Python not found. Installing Python 3.12 - this is free and takes a minute...
    where winget >nul 2>nul
    if !errorlevel! == 0 (
        winget install -e --id Python.Python.3.12 --scope user --silent --accept-source-agreements --accept-package-agreements
    ) else (
        echo [setup] Downloading the Python installer...
        curl -L -o "%TEMP%\python-setup.exe" "https://www.python.org/ftp/python/3.12.7/python-3.12.7-amd64.exe"
        start "" /wait "%TEMP%\python-setup.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_launcher=1
    )
    call :find_python
)
if not defined PY (
    echo.
    echo [error] Python still isn't available. Install it from https://www.python.org/downloads/
    echo         tick "Add python.exe to PATH" during install, then run START.bat again.
    goto :fail
)
echo [setup] Using Python: %PY%

rem ------------------------------------------------------------
rem  2. Python packages, in a private folder so nothing else is touched
rem ------------------------------------------------------------
if not exist ".venv\Scripts\python.exe" (
    echo [setup] Creating the Python environment...
    %PY% -m venv .venv
    if errorlevel 1 goto :fail
)
set "VPY=.venv\Scripts\python.exe"

fc /b requirements.txt ".venv\installed.txt" >nul 2>nul
if errorlevel 1 (
    echo [setup] Installing packages: TikTok chat reader, voice, web server...
    "%VPY%" -m pip install --disable-pip-version-check -q --upgrade pip
    "%VPY%" -m pip install --disable-pip-version-check -q -r requirements.txt
    if errorlevel 1 (
        echo [error] Package install failed. Check your internet connection and try again.
        goto :fail
    )
    copy /y requirements.txt ".venv\installed.txt" >nul
) else (
    echo [setup] Packages already installed.
)

rem ------------------------------------------------------------
rem  2b. Voice clone engine - only when there's an impression clip
rem      in assets\voices (recorded in the Voice Lab or dropped in)
rem ------------------------------------------------------------
set "HASCLIP="
for %%E in (wav flac mp3 ogg) do (
    if exist "assets\voices\mario.%%E" set "HASCLIP=1"
    if exist "assets\voices\luigi.%%E" set "HASCLIP=1"
)
if defined HASCLIP if not exist ".venv\clone-installed.txt" (
    echo [setup] Impression clip found. Installing the voice clone engine - big download, 2-4 GB, one time only...
    where nvidia-smi >nul 2>nul
    if !errorlevel! == 0 (
        echo [setup] NVIDIA graphics card found - installing the fast GPU version.
        "%VPY%" -m pip install --disable-pip-version-check torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu124
    ) else (
        echo [setup] No NVIDIA card found - installing the CPU version. Lines will take a few seconds each.
        "%VPY%" -m pip install --disable-pip-version-check torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cpu
    )
    "%VPY%" -m pip install --disable-pip-version-check chatterbox-tts
    if errorlevel 1 (
        echo [warn] The voice clone engine didn't install. Mario will use the normal voice for now.
    ) else (
        echo done> ".venv\clone-installed.txt"
    )
)

rem ------------------------------------------------------------
rem  3. Ollama - runs the free Hugging Face AI model on your PC
rem ------------------------------------------------------------
set "OLLAMA="
call :find_ollama
if not defined OLLAMA (
    echo [setup] The AI engine Ollama isn't installed. Installing it now - free, no account...
    where winget >nul 2>nul
    if !errorlevel! == 0 (
        winget install -e --id Ollama.Ollama --silent --accept-source-agreements --accept-package-agreements
    )
    call :find_ollama
)
if not defined OLLAMA (
    echo [setup] Downloading the Ollama installer...
    curl -L -o "%TEMP%\OllamaSetup.exe" "https://ollama.com/download/OllamaSetup.exe"
    if exist "%TEMP%\OllamaSetup.exe" start "" /wait "%TEMP%\OllamaSetup.exe" /VERYSILENT /NORESTART /SUPPRESSMSGBOXES
    call :find_ollama
)
if not defined OLLAMA (
    echo [warn] Couldn't install Ollama automatically. Get it free from https://ollama.com/download
    echo        Mario will still run, but with backup answers until the AI is installed.
) else (
    echo [setup] AI engine found: !OLLAMA!
    rem Make sure the AI server is running - the app waits for it and downloads the model if needed.
    curl -s -o nul http://127.0.0.1:11434/api/version
    if errorlevel 1 start "" /min "!OLLAMA!" serve
)

rem ------------------------------------------------------------
rem  4. Go!
rem ------------------------------------------------------------
echo.
echo [start] Starting Mario Live... the Mario window will open by itself.
echo.
"%VPY%" -m server
if errorlevel 1 goto :fail
goto :eof

:find_python
for %%C in ("py -3" "python" "python3") do (
    if not defined PY (
        %%~C -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
        if !errorlevel! == 0 set "PY=%%~C"
    )
)
if not defined PY (
    for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*") do (
        if exist "%%D\python.exe" set "PY="%%D\python.exe""
    )
)
exit /b 0

:find_ollama
for /f "delims=" %%O in ('where ollama 2^>nul') do if not defined OLLAMA set "OLLAMA=%%O"
if not defined OLLAMA if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "OLLAMA=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
if not defined OLLAMA if exist "%ProgramFiles%\Ollama\ollama.exe" set "OLLAMA=%ProgramFiles%\Ollama\ollama.exe"
exit /b 0

:fail
echo.
echo Something went wrong - read the messages above. Press any key to close.
pause >nul
exit /b 1
