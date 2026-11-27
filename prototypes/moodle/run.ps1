$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
& "$PSScriptRoot\.venv\Scripts\python.exe" "$PSScriptRoot\courses.py"
Write-Host "Code de sortie : $LASTEXITCODE"
Read-Host 'Appuyez sur Entree pour fermer'
