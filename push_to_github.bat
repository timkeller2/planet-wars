@echo off
echo ===================================================
echo 🚀 Planet Wars - Push to GitHub
echo ===================================================
echo.
echo This script will help you push your game to your GitHub repository.
echo.
echo Before running:
echo 1. Create a new repository on GitHub (e.g. named "planet-wars")
echo    at https://github.com/new
echo 2. Do NOT check "Add a README file", "Add .gitignore", or "Choose a license"
echo    (keep it completely empty).
echo.

set /p REPO_URL="Enter your GitHub Repository URL: "
if "%REPO_URL%"=="" goto error_missing

echo.
echo [1/2] Setting remote origin...
git remote remove origin 2>nul
git remote add origin %REPO_URL%

echo.
echo [2/2] Pushing local master branch to GitHub...
git push -u -f origin master

if %ERRORLEVEL% equ 0 (
    echo.
    echo ===================================================
    echo 🎉 SUCCESS: Successfully pushed to GitHub!
    echo ===================================================
    echo.
    echo Now you are ready to deploy on Render.com!
    echo.
    echo 1. Go to https://dashboard.render.com
    echo 2. Click "New +" (top right) and select "Web Service"
    echo 3. Select your "planet-wars" repository
    echo 4. Render will automatically detect your setup and deploy!
) else (
    echo.
    echo ❌ ERROR: Push failed.
    echo Please make sure your GitHub repository URL is correct and you have permission.
)
goto end

:error_missing
echo.
echo ❌ ERROR: Repository URL is required.
goto end

:end
echo.
pause
