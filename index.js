require('dotenv').config();
const express = require('express');
const app = express();
const {
  DescribeInstancesCommand,
  EC2Client
} = require("@aws-sdk/client-ec2");

const {
  AutoScalingClient,
  SetDesiredCapacityCommand,
  DescribeAutoScalingGroupsCommand,
  TerminateInstanceInAutoScalingGroupCommand,
  DescribeAutoScalingInstancesCommand
} = require("@aws-sdk/client-auto-scaling");

const port = 3000;

const client = new AutoScalingClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const ec2Client = new EC2Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

let ALL_MACHINES = [];

async function refreshInstances() {
  try {
    const data = await client.send(new DescribeAutoScalingInstancesCommand({}));
    const instanceIds = data.AutoScalingInstances?.map(x => x.InstanceId).filter(Boolean) || [];

    if (instanceIds.length === 0) {
      console.log("No instances found.");
      return;
    }

    const ec2Response = await ec2Client.send(new DescribeInstancesCommand({
      InstanceIds: instanceIds,
    }));

    const newInstances = ec2Response.Reservations.flatMap(reservation =>
      reservation.Instances.map(instance => ({
        id: instance.InstanceId,
        ip: instance.PublicDnsName,
        isUsed: false,
      }))
    );

    newInstances.forEach((newIns) => {
      const exists = ALL_MACHINES.some(machine => machine.id === newIns.id);
      if (!exists) {
        ALL_MACHINES.push(newIns);
      }
    });

    console.log("Updated ALL_MACHINES", ALL_MACHINES);
  } catch (err) {
    console.error("Failed to refresh instances:", err);
  }
}

setInterval(refreshInstances, 10000);

app.use(express.json());

app.get("/", async (req, res) => {
  const idleMachine = ALL_MACHINES.find(x => !x.isUsed);
      console.log("idleMachine",idleMachine)
  if (!idleMachine) {
    // No available machine — scale up
    const desiredCapacity = ALL_MACHINES.length + 1;

    const scaleCommand = new SetDesiredCapacityCommand({
      AutoScalingGroupName: "vscode-asg",
      DesiredCapacity: desiredCapacity
    });

    try {
      await client.send(scaleCommand);
      console.log(`Scaling up to ${desiredCapacity} machines...`);
    } catch (error) {
      console.error("Error scaling up:", error);
    }

    return res.status(404).send("No idle machine found. Scaling up...");
  }

  // Mark the selected machine as used
  idleMachine.isUsed = true;
  console.log("Assigned machine:", idleMachine);
res.redirect(302, `http://${idleMachine.ip}:8080`);


 // res.send({ ip: idleMachine.ip });
});


app.post("/destroy", async (req, res) => {
  const machineId = req.body.machineId;

  if (!machineId) {
    return res.status(400).json({ error: "Missing machineId in request body" });
  }

  try {
    const command = new TerminateInstanceInAutoScalingGroupCommand({
      InstanceId: machineId,
      ShouldDecrementDesiredCapacity: true,
    });

    const response = await client.send(command);
    res.status(200).json({ message: "Instance termination initiated", response });
  } catch (error) {
    console.error("Error terminating instance:", error);
    res.status(500).json({ error: "Failed to terminate instance" });
  }
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});

