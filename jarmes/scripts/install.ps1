<#
 Instalação do JARMES no Windows 10/11 (PowerShell).
 Uso (na pasta do projeto):   powershell -ExecutionPolicy Bypass -File scripts\install.ps1
 Opções:  -Tests (roda os testes ao final)   -Shortcut (cria atalho na Área de Trabalho)
#>
param([switch]$Tests, [switch]$Shortcut)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

function Find-Python {
    foreach ($ver in @("3.13", "3.12", "3.11", "3.10")) {
        try {
            $out = & py "-$ver" -c "import sys; print(sys.version_info[:2])" 2>$null
            if ($LASTEXITCODE -eq 0) { return $ver }
        } catch { }
    }
    return $null
}

$ver = Find-Python
if (-not $ver) {
    Write-Host "Python 3.10-3.13 não encontrado." -ForegroundColor Red
    Write-Host "Instale em https://www.python.org/downloads/windows/ (marque 'Add python.exe to PATH' e o 'py launcher') e rode este script de novo."
    exit 1
}
Write-Host "Usando Python $ver" -ForegroundColor Cyan

if (-not (Test-Path ".venv")) { & py "-$ver" -m venv .venv }
$python = Join-Path (Get-Location) ".venv\Scripts\python.exe"
& $python -m pip install --upgrade pip
& $python -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { Write-Host "Falha ao instalar dependências." -ForegroundColor Red; exit 1 }

if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env"; Write-Host "Criei .env — edite-o para configurar IA/Google (opcional)." -ForegroundColor Yellow }

if ($Shortcut) {
    $ws = New-Object -ComObject WScript.Shell
    $lnk = $ws.CreateShortcut((Join-Path ([Environment]::GetFolderPath("Desktop")) "JARMES.lnk"))
    $lnk.TargetPath = (Join-Path (Get-Location) "iniciar_jarmes.bat")
    $lnk.WorkingDirectory = (Get-Location).Path
    $lnk.IconLocation = (Join-Path (Get-Location) "src\jarmes\assets\jarmes.ico")
    $lnk.Save()
    Write-Host "Atalho criado na Área de Trabalho." -ForegroundColor Green
}

if ($Tests) {
    & $python -m pip install pytest
    $env:QT_QPA_PLATFORM = "offscreen"
    & $python -m pytest
}
Write-Host "`nPronto! Inicie com:  iniciar_jarmes.bat" -ForegroundColor Green
