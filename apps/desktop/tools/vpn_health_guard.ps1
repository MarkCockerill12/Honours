# vpn_health_guard.ps1
# This script monitors the VPN tunnel health and ensures internet connectivity (Wi-Fi)
# is maintained. It will automatically shut down the VPN if it detects a lockout.

$ErrorActionPreference = "Continue"
$LogFile = "C:\Users\Mark\OneDrive - University of Dundee\yr4\Honours\CODE\Honours\apps\desktop\vpn_health.log"
$WGPath = "c:\Users\Mark\OneDrive - University of Dundee\yr4\Honours\CODE\Honours\apps\desktop\bin\wireguard.exe"
$GW = "172.16.10.1"
$InternetNode = "8.8.8.8"

function Write-Log {
    param($msg)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $msg" | Out-File -FilePath $LogFile -Append
    Write-Host "$timestamp - $msg"
}

Write-Log "VPN Health Guard Initialized. Monitoring interval: 15s"
Write-Log "Binary Path: $WGPath"

while ($true) {
    try {
        # 1. Check if ANY WireGuard tunnel is active via Service lookup
        $wgRunning = Get-Service "WireGuardTunnel*" -ErrorAction Ignore | Where-Object Status -eq "Running"
        
        if ($wgRunning) {
            $tunnelName = $wgRunning.Name -replace "WireGuardTunnel", ""
            Write-Log "Tunnel active: $tunnelName. Checking transit..."

            # 2. Ping 8.8.8.8 (Internet)
            $pingInt = Test-Connection -ComputerName $InternetNode -Count 1 -Quiet -Delay 0
            
            if ($pingInt) {
                Write-Log "✅ Internet transit: OK (8.8.8.8 reached via tunnel)."
            } else {
                Write-Log "⚠️  INTERNET LOCKOUT DETECTED. Internet (8.8.8.8) unreachable while VPN is up."
                
                # Check 10.0.0.1 (VPN Gateway)
                $pingGW = Test-Connection -ComputerName $GW -Count 1 -Quiet -Delay 0
                if ($pingGW) {
                  Write-Log "✅ Gateway 10.0.0.1 is reachable. Issue is routing / NAT beyond gateway."
                } else {
                  Write-Log "❌ Gateway 10.0.0.1 is unreachable. Tunnel handshake likely failed."
                }

                # FAILSAFE: Shut down all WireGuard tunnels to restore native Wi-Fi
                Write-Log "🔴 [FAILSAFE] Shutting down tunnel '$tunnelName' to restore connectivity..."
                Start-Process "$WGPath" -ArgumentList "/uninstalltunnelservice", "$tunnelName" -Wait
                Write-Log "✅ Tunnel terminated. Native Wi-Fi should be restored."
            }
        }
    } catch {
        $ex = $_.ToString()
        Write-Log "Diagnostic error: $ex"
    }

    Start-Sleep -Seconds 15
}
