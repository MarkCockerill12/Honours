/* eslint-disable @typescript-eslint/no-require-imports */
const { EC2Client, DescribeInstancesCommand, ModifyInstanceAttributeCommand } = require("@aws-sdk/client-ec2");
const path = require("node:path");
const fs = require("node:fs");

const envPath = require("node:path").resolve(__dirname, "../../../.env.local");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
} else {
  console.log("Could not find .env.local at " + envPath);
  process.exit(1);
}

async function fixInstances() {
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
          console.log(`- Checking Instance: ${inst.InstanceId} (${inst.State.Name})`);
          
          if (inst.SourceDestCheck) {
            console.log(`  [FIX] Disabling SourceDestCheck for ${inst.InstanceId}...`);
            await client.send(new ModifyInstanceAttributeCommand({
              InstanceId: inst.InstanceId,
              SourceDestCheck: { Value: false }
            }));
            console.log(`  [OK] Disabled.`);
          } else {
            console.log(`  [PASS] SourceDestCheck already disabled.`);
          }
        }
      }
    } catch (err) {
      console.error(`Error in ${region}:`, err.message);
    }
  }
}

fixInstances();
