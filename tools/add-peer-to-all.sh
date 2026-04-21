#!/bin/bash
# Add Desktop Client Peer to All VPN Servers
# Run this after server restarts to ensure client can connect

CLIENT_PUB="zyj0qUZj8xCu3Yu1AQVBteFB7glVz/NGSxO9Ct7F4QI="
CLIENT_IP="172.16.10.2"

echo "🔧 Adding client peer to all VPN servers..."
echo ""

# Get current server IPs from AWS
SERVERS=$(aws ec2 describe-instances \
  --filters "Name=tag:Project,Values=PrivacySentinel" "Name=instance-state-name,Values=running" \
  --query 'Reservations[*].Instances[*].[Tags[?Key==`Name`].Value|[0],PublicIpAddress]' \
  --output text 2>/dev/null || echo "")

if [ -z "$SERVERS" ]; then
  echo "❌ No running servers found. Trying all known IPs..."
  SERVERS="VPN-US 18.212.225.114
VPN-UK 13.135.103.67
VPN-Germany 18.196.108.117
VPN-Japan 54.249.201.97
VPN-Sydney 3.107.97.52"
fi

# Add peer to each server
while IFS= read -r line; do
  NAME=$(echo "$line" | awk '{print $1}')
  IP=$(echo "$line" | awk '{print $2}')

  if [ -z "$IP" ] || [ "$IP" = "None" ]; then
    continue
  fi

  echo "=== $NAME ($IP) ==="

  # Try to add peer via SSH
  timeout 15 ssh -i keysETC/PrivacyShield-Key.pem -o StrictHostKeyChecking=no -o ConnectTimeout=5 ubuntu@$IP \
    "sudo wg set wg0 peer $CLIENT_PUB allowed-ips $CLIENT_IP/32 persistent-keepalive 25 && \
     sudo wg show wg0 | grep -q '$CLIENT_PUB' && echo '✅ Peer added' || echo '❌ Failed'" 2>&1 | \
    grep -E "✅|❌" || echo "⚠️  Connection timeout"

  echo ""
done <<< "$SERVERS"

echo "✅ Complete! Test with: ssh -i keysETC/PrivacyShield-Key.pem ubuntu@<IP> 'sudo wg show wg0'"
