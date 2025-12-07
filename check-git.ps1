Set-Location c:\dev\cctp-relayer
$output = @()
$output += "=== GIT LOG ==="
$output += (git log --oneline -5 2>&1)
$output += ""
$output += "=== GIT STATUS ==="
$output += (git status 2>&1)
$output += ""
$output += "=== TRACKED FILES ==="
$output += (git ls-files 2>&1)
$output += ""
$output += "=== REMOTE ==="
$output += (git remote -v 2>&1)
$output | Out-File -FilePath "c:\dev\cctp-relayer\git-debug.txt" -Encoding UTF8

