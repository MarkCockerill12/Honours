/* eslint-disable @typescript-eslint/no-require-imports */
const { EC2Client, DescribeInstancesCommand, DescribeNetworkInterfacesCommand } = require("@aws-sdk/client-ec2");
const path = require("node:path");
const fs = require("node:fs");

// Use an absolute path if possible or re-verify. 
// Root is C:\Users\Mark\OneDrive - University of Dundee\yr4\Honours\CODE\Honours
const envPath = "C:\\Users\\Mark\\OneDrive - University of Dundee\\yr4\\Honours\\CODE\\Honours\\.env.local";
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
} else {
  console.log("Could not find .env.local at " + envPath);
}

async function checkInstances() {
  const regions = ["us-east-1", "eu-west-2", "eu-central-1", "ap-northeast-1", "ap-southeast-2"];
  
  for (const region of regions) {
    const client = new EC2Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    try {
      const result = await client.send(new DescribeInstancesCommand({
        Filters: [{ Name: "tag:Name", Values: ["VPN-US", "VPN-UK", "VPN-Germany", "VPN-Japan", "VPN-Sydney"] }],
      }));

      const instances = result.Reservations.flatMap(r => r.Instances);
      if (instances.length > 0) {
        console.log(`\nRegion: ${region}`);
        for (const inst of instances) {
          console.log(`- Instance: ${inst.InstanceId} (${inst.State.Name})`);
          console.log(`  Public IP: ${inst.PublicIpAddress || "None"}`);
          console.log(`  Source/Dest Check: ${inst.SourceDestCheck ? "ENABLED (Bad for VPN)" : "DISABLED (Good for VPN)"}`);
          
          const niResult = await client.send(new DescribeNetworkInterfacesCommand({
            NetworkInterfaceIds: inst.NetworkInterfaces.map(ni => ni.NetworkInterfaceId),
          }));
          
          for (const ni of niResult.NetworkInterfaces) {
            console.log(`  Interface: ${ni.NetworkInterfaceId}`);
            console.log(`  Primary Private IP: ${ni.PrivateIpAddress}`);
          }
        }
      }
    } catch (err) {
      // console.error(`Error in ${region}:`, err.message);
    }
  }
}

checkInstances();
