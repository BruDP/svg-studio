# Launcher SVG Studio: avvia il server locale (se non gia attivo) e apre il browser sulla UX.
# Pensato per essere lanciato dal collegamento sul desktop. Chiudere questa finestra ferma il tool.
$ErrorActionPreference = 'SilentlyContinue'
$progetto = Split-Path -Parent $PSScriptRoot   # cartella del progetto (padre di scripts/)
$url = 'http://localhost:3000/studio'
Set-Location $progetto

function Porta-Attiva {
  try {
    $c = New-Object Net.Sockets.TcpClient
    $c.Connect('localhost', 3000)
    $c.Close()
    return $true
  } catch { return $false }
}

# Gia attivo (magari da un avvio precedente): apri solo il browser e termina.
if (Porta-Attiva) {
  Start-Process $url
  return
}

$Host.UI.RawUI.WindowTitle = 'SVG Studio - server attivo (chiudi questa finestra per fermare il tool)'
Write-Host 'Avvio SVG Studio in corso... si aprira il browser tra pochi secondi.' -ForegroundColor Cyan
Write-Host 'NON chiudere questa finestra mentre usi il tool. Chiudila per fermarlo.' -ForegroundColor Yellow

# In parallelo: attende che il server risponda, poi apre il browser una volta sola.
Start-Job {
  for ($i = 0; $i -lt 120; $i++) {
    try {
      $c = New-Object Net.Sockets.TcpClient
      $c.Connect('localhost', 3000)
      $c.Close()
      Start-Process 'http://localhost:3000/studio'
      break
    } catch { Start-Sleep -Seconds 1 }
  }
} | Out-Null

# Server in primo piano: i log restano in questa finestra, chiuderla ferma il processo.
npm run dev
