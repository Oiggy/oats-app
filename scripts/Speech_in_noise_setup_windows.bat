@echo off
echo ============================================
echo  OATS - Python Environment Setup (Windows)
echo ============================================
echo.

echo Step 1: Downloading Miniforge...
curl -L -o "%TEMP%\miniforge.exe" https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Windows-x86_64.exe
if errorlevel 1 (
    echo ERROR: Failed to download Miniforge. Check your internet connection.
    pause
    exit /b 1
)

echo Step 2: Installing Miniforge...
"%TEMP%\miniforge.exe" /S /AddToPath=1 /RegisterPython=0
if errorlevel 1 (
    echo ERROR: Miniforge installation failed.
    pause
    exit /b 1
)

set PATH=%USERPROFILE%\miniforge3\Scripts;%USERPROFILE%\miniforge3\condabin;%PATH%

echo Step 3: Creating psignifit environment...
call conda create -n psignifit python=3.12 -y
if errorlevel 1 (
    echo ERROR: Failed to create conda environment.
    pause
    exit /b 1
)

echo Step 4: Installing Python packages...
call conda run -n psignifit pip install psignifit matplotlib pandas numpy
if errorlevel 1 (
    echo ERROR: Failed to install packages.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Setup complete! You can now run OATS.
echo ============================================
pause
