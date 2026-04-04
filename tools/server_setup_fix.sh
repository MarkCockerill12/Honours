#!/bin/bash
# ------------------------------------------------------------------
# PRIVACY SHIELD VPN - Server Gateway Fix (v1.6)
# ------------------------------------------------------------------
# This script ensures the EC2 instance is performing NAT for the 
# VPN clients (10.0.0.0/24 subnet). 
# ------------------------------------------------------------------

# 1. Enable IP Forwarding at the OS level
echo "Enabling IP Forwarding..."
sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf

# 2. Setup iptables rules for NAT and Forwarding
echo "Applying iptables NAT Rules..."
# Detect primary interface (usually eth0 or ens5)
IFACE=$(ip route get 8.8.8.8 | grep -Po '(?<=dev )(\S+)')

# MASQUERADE internal VPN traffic out to the internet
sudo iptables -t nat -A POSTROUTING -s 10.150.0.0/24 -o "$IFACE" -j MASQUERADE
# Allow forwarding
sudo iptables -A FORWARD -i wg0 -j ACCEPT
sudo iptables -A FORWARD -o wg0 -j ACCEPT

# 3. Persist the rules across reboots
echo "Installing iptables-persistent for persistence..."
DEBIAN_FRONTEND=noninteractive sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save

echo "Done! Handshake and transit should now be operational."
echo "Current wg status:"
sudo wg show
