/* eslint-disable @typescript-eslint/no-require-imports */
const { EC2Client, StopInstancesCommand, DescribeInstancesCommand } = require("@aws-sdk/client-ec2");
const path = require("node:path");
const fs = require("node:fs");

const envPath = require("node:path").resolve(__dirname, "../../../.env.local");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
} else {
  process.exit(1);
}

async function shutdownActiveServers() {
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

      const runningInstances = result.Reservations
        .flatMap(r => r.Instances)
        .filter(i => i.State.Name === "running")
        .map(i => i.InstanceId);

      if (runningInstances.length > 0) {
        console.log(`Region ${region}: Stopping ${runningInstances.length} running instances...`);
        await client.send(new StopInstancesCommand({ InstanceIds: runningInstances }));
        console.log(`[OK] All nodes in ${region} are shutting down.`);
      }
    } catch (err) {
      // console.error(`Error in ${region}:`, err.message);
    }
  }
}

shutdownActiveServers();
