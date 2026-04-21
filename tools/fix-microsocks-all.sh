#!/bin/bash
# Fix microsocks on all VPN servers

echo "[Fix] Ensuring microsocks is running and enabled..."

# Start microsocks
sudo systemctl daemon-reload
sudo systemctl enable microsocks
sudo systemctl restart microsocks
sleep 2

# Verify status
if sudo systemctl is-active --quiet microsocks; then
  echo "[Fix] ✅ microsocks is running"
  sudo ss -tlnp | grep 1080
else
  echo "[Fix] ❌ microsocks failed to start"
  sudo journalctl -u microsocks --no-pager -n 10
fi

# Add client peer if not present
CLIENT_PUB="zyj0qUZj8xCu3Yu1AQVBteFB7glVz/NGSxO9Ct7F4QI="
CLIENT_IP="172.16.10.2"

if ! sudo wg show wg0 | grep -q "$CLIENT_PUB"; then
  echo "[Fix] Adding client peer..."
  sudo wg set wg0 peer "$CLIENT_PUB" allowed-ips "$CLIENT_IP/32" persistent-keepalive 25

  # Make persistent
  if ! sudo grep -q "$CLIENT_PUB" /etc/wireguard/wg0.conf; then
    echo "" | sudo tee -a /etc/wireguard/wg0.conf
    echo "[Peer]" | sudo tee -a /etc/wireguard/wg0.conf
    echo "PublicKey = $CLIENT_PUB" | sudo tee -a /etc/wireguard/wg0.conf
    echo "AllowedIPs = $CLIENT_IP/32" | sudo tee -a /etc/wireguard/wg0.conf
    echo "PersistentKeepalive = 25" | sudo tee -a /etc/wireguard/wg0.conf
  fi
fi

echo "[Fix] Complete!"
