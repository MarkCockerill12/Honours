/* eslint-disable @typescript-eslint/no-require-imports */
const { EC2Client, StartInstancesCommand, DescribeInstancesCommand } = require("@aws-sdk/client-ec2");
const fs = require("node:fs");

const envPath = require("node:path").resolve(__dirname, "../../../.env.local");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
} else {
  process.exit(1);
}

const client = new EC2Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function runTest() {
  const result = await client.send(new DescribeInstancesCommand({
    Filters: [{ Name: "tag:Name", Values: ["VPN-US"] }],
  }));

  const instanceId = result.Reservations[0].Instances[0].InstanceId;
  console.log(`Starting instance: ${instanceId}`);
  await client.send(new StartInstancesCommand({ InstanceIds: [instanceId] }));

  // Poll for IP
  let publicIp = "";
  for (let i = 0; i < 30; i++) {
    const desc = await client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
    const inst = desc.Reservations[0].Instances[0];
    if (inst.State.Name === "running" && inst.PublicIpAddress) {
      publicIp = inst.PublicIpAddress;
      break;
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  
  if (publicIp) {
    console.log(`IP_READY:${publicIp}`);
  } else {
    console.log("TIMEOUT");
  }
}

runTest();
