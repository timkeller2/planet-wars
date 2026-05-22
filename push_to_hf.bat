@echo off
echo ===================================================
echo 🚀 Planet Wars - Hugging Face Spaces Deployer
echo ===================================================
echo.
echo This script will help you automatically push your game to Hugging Face.
echo.
echo Before running:
echo 1. Make sure you created a new Space named "planet-wars" on HF
echo    at https://huggingface.co/new-space
echo 2. Choose "Docker" as the SDK (with a "Blank" template)
echo.

set /p HF_USER="Enter your Hugging Face Username: "
if "%HF_USER%"=="" goto error_missing

echo.
echo To authenticate, you need a Hugging Face Access Token.
echo Create one with WRITE permission at: https://huggingface.co/settings/tokens
echo.
set /p HF_TOKEN="Enter your Hugging Face Access Token: "
if "%HF_TOKEN%"=="" goto error_missing

echo.
echo [1/2] Configuring Hugging Face Git remote...
git remote remove hf 2>nul
git remote add hf https://%HF_USER%:%HF_TOKEN%@huggingface.co/spaces/%HF_USER%/planet-wars

echo.
echo [2/2] Pushing local master branch to Hugging Face main branch...
git push -f hf master:main

if %ERRORLEVEL% equ 0 (
    echo.
    echo ===================================================
    echo 🎉 SUCCESS: Successfully pushed to Hugging Face!
    echo ===================================================
    echo.
    echo Your game is building and will be live in a few minutes.
    echo View building logs and play it at:
    echo.
    echo https://huggingface.co/spaces/%HF_USER%/planet-wars
    echo.
) else (
    echo.
    echo ❌ ERROR: Push failed.
    echo Please make sure:
    echo 1. Your Space is named "planet-wars" (all lowercase, hyphenated)
    echo 2. Your HF Username and Access Token are correct
    echo 3. The Access Token has WRITE permission
)
goto end

:error_missing
echo.
echo ❌ ERROR: Username and Access Token are required.
goto end

:end
echo.
pause
