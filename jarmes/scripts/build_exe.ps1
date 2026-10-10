<#
 Gera o executável independente do JARMES (Windows) com PyInstaller.
 Resultado: dist\JARMES\JARMES.exe  (pasta completa; copie a pasta inteira)
 Uso:  powershell -ExecutionPolicy Bypass -File scripts\build_exe.ps1 [-Installer]
 -Installer: se o Inno Setup 6 estiver instalado, também gera dist\JARMES-Setup.exe
#>
param([switch]$Installer)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
if (-not (Test-Path ".venv")) { & powershell -ExecutionPolicy Bypass -File scripts\install.ps1 }
$python = Join-Path (Get-Location) ".venv\Scripts\python.exe"
& $python -m pip install -r requirements-dev.txt
& $python scripts\make_icon.py
& $python -m PyInstaller jarmes.spec --noconfirm --clean
if ($LASTEXITCODE -ne 0) { Write-Host "PyInstaller falhou." -ForegroundColor Red; exit 1 }
Write-Host "Executável: dist\JARMES\JARMES.exe" -ForegroundColor Green
if ($Installer) {
    $iscc = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
    if (Test-Path $iscc) { & $iscc scripts\installer.iss; Write-Host "Instalador: dist\JARMES-Setup.exe" -ForegroundColor Green }
    else { Write-Host "Inno Setup 6 não encontrado (https://jrsoftware.org/isinfo.php); pulei o instalador." -ForegroundColor Yellow }
}
