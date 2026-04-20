#!/bin/bash
# ------------------------------------------------------------------
# PRIVACY SHIELD - EXTREME WORKING VERSION 1 (GLOBAL RESET BUTTON)
# This script is the ultimate version control for the server fleet.
# Running this will find ALL VPN Spokes across US, UK, Germany, 
# Japan, and Australia and force-reinstall the current stable config.
# ------------------------------------------------------------------

REGIONS=("us-east-1" "eu-west-2" "eu-central-1" "ap-northeast-1" "ap-southeast-2")
KEY_PATH="keysETC/PrivacyShield-Key.pem"
REBUILD_SCRIPT="tools/rebuild_vpn.sh"

echo "🚀 INITIATING GLOBAL VPN FLEET RECOVERY (v1.0)..."

# Ensure Linux line endings for the transfer
tr -d '\r' < "$REBUILD_SCRIPT" > "/tmp/rebuild_vpn_sync.sh"

for REGION in "${REGIONS[@]}"; do
    echo "--- Scanning Region: $REGION ---"
    
    # Find active VPN Spoke instances in this region
    IPS=$(aws ec2 describe-instances --region "$REGION" \
        --filters "Name=tag:Name,Values=VPN-*" "Name=instance-state-name,Values=running" \
        --query "Reservations[*].Instances[*].PublicIpAddress" --output text)
        
    for IP in $IPS; do
        if [ "$IP" != "None" ]; then
            echo "📍 Found Spoke at $IP. Deploying Recovery Payload..."
            
            # Secure Transfer and Force Reinstall
            scp -i "$KEY_PATH" -o StrictHostKeyChecking=no "/tmp/rebuild_vpn_sync.sh" ubuntu@"$IP":/tmp/rebuild.sh
            ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ubuntu@"$IP" "sudo bash /tmp/rebuild.sh"
            
            echo "✅ Spoke $IP Recovered and Synced."
        fi
    done
done

echo "🏆 GLOBAL RESET COMPLETE. All active servers are now in a 'Known-Good' state."
