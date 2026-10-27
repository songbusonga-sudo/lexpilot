param([switch]$SkipChecks)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
function Assert-Success([string]$Step) {
    if ($LASTEXITCODE -ne 0) { throw "$Step failed (exit $LASTEXITCODE)" }
}
Push-Location $projectRoot
try {
    if (-not $SkipChecks) {
        npm test
        Assert-Success 'Tests'
    }
    npm run build
    Assert-Success 'Build'
    $releaseId = Get-Date -Format 'yyyyMMdd-HHmmss'
    $archive = Join-Path $env:TEMP "qingdun-$releaseId.tar.gz"
    tar -czf $archive server dist package.json package-lock.json scripts/deploy-release.sh
    Assert-Success 'Package'
    scp -o BatchMode=yes $archive "pingpop-prod:/tmp/qingdun-$releaseId.tar.gz"
    Assert-Success 'Upload'
    scp -o BatchMode=yes scripts/deploy-release.sh pingpop-prod:/tmp/qingdun-deploy-release.sh
    Assert-Success 'Upload release script'
    ssh -o BatchMode=yes pingpop-prod "bash /tmp/qingdun-deploy-release.sh /tmp/qingdun-$releaseId.tar.gz $releaseId"
    Assert-Success 'Release'
    scp -o BatchMode=yes scripts/verify-server.py pingpop-prod:/tmp/qingdun-verify-server.py
    Assert-Success 'Upload verification script'
    ssh -o BatchMode=yes pingpop-prod 'python3 /tmp/qingdun-verify-server.py'
    Assert-Success 'Public HTTPS and origin verification'
    Write-Host 'Server deployment verified: https://lexpilot.mizki.online'
} finally {
    Pop-Location
}
