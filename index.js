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

    ALL_MACHINES = ec2Response.Reservations.flatMap(reservation =>
      reservation.Instances.map(instance => ({
        id: instance.InstanceId,
        ip: instance.PublicDnsName,
        isUsed: false,
      }))
    );

    console.log("Updated ALL_MACHINES", ALL_MACHINES);
  } catch (err) {
    console.error("Failed to refresh instances:", err);
  }
}

setInterval(refreshInstances, 10000);

app.use(express.json());

app.get("/", async (req, res) => {
  const idleMachine = ALL_MACHINES.find(x => x.isUsed === false);

  if (!idleMachine) {
    const scaleCommand = new SetDesiredCapacityCommand({
      AutoScalingGroupName: "vscode-asg",
      DesiredCapacity: ALL_MACHINES.length + 1
    });

    try {
      await client.send(scaleCommand);
    } catch (error) {
      console.error("Error scaling up:", error);
    }

    return res.status(404).send("No idle machine found. Scaling up...");
  }

  idleMachine.isUsed = true;
  console.log("idleMachine",idleMachine)

  res.send({ ip: idleMachine.ip });
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

// require('dotenv').config();
// const express = require('express')
// const app = express()
// const {
//   DescribeInstancesCommand,
//   EC2Client
// } = require("@aws-sdk/client-ec2");


// const port = 3000

// const { AutoScalingClient,
//     SetDesiredCapacityCommand,
//      DescribeAutoScalingGroupsCommand,
//      TerminateInstanceInAutoScalingGroupCommand,
//     DescribeAutoScalingInstancesCommand } = require("@aws-sdk/client-auto-scaling");


// const client = new AutoScalingClient({
//     region: process.env.AWS_REGION,
//     credentials: {
//       accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//       secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//     },
//   });

// const command = new SetDesiredCapacityCommand({
//     AutoScalingGroupName: "vscode-asg",
//     DesiredCapacity: 2,
// })


// const run = async () => {
//     try {
//       const response = await client.send(command);
//       console.log("Desired capacity updated successfully", response);
//     } catch (err) {
//       console.error("Error updating desired capacity", err);
//     }
//   };
  
//   run();

//   let ALL_MACHINES = []
//   const ec2Client = new EC2Client({});

//   async function refreshInstances() {
//     try {
//       const command = new DescribeAutoScalingInstancesCommand({});
//       const data = await client.send(command);
//     //  console.log("data mechine",data)
//     //ALL_MACHINES = data.AutoScalingInstances
  
//       const instanceIds = data.AutoScalingInstances?.map(x => x.InstanceId).filter(Boolean) || [];
//       console.log("data instanceIds",instanceIds)
//       if (instanceIds.length === 0) {
//         console.log("No instances found.");
//         return;
//       }
  
//       const ec2InstanceCommand = new DescribeInstancesCommand({
//         InstanceIds: instanceIds,
//       });
  
//       const ec2Response = await ec2Client.send(ec2InstanceCommand);
  
//      // console.log(JSON.stringify(ec2Response.Reservations[0].Instances[0]));
//     } catch (err) {
//       console.error("Failed to refresh instances:", err);
//     }
//   }

// //console.log("all mechine",all_mechine)
// setInterval(async()=>{
//   refreshInstances()
// },1000*10)
// console.log("all mechine",ALL_MACHINES)

// app.use(express.json())
// app.get("/projectId", (req, res) => {
//   console.log("hrll")
//   const idleMachine = ALL_MACHINES.find(x => x.isUsed === false);
  
//   if (!idleMachine) {
//     // scale up the infrastructure
//     res.status(404).send("No idle machine found");
//     return;
//   }

//   idleMachine.isUsed = true;
//   // scale up the infrastructure

//   const command = new SetDesiredCapacityCommand({
//     AutoScalingGroupName: "vscode-asg",
//     DesiredCapacity: ALL_MACHINES.length + 
//       (5 - ALL_MACHINES.filter(x => x.isUsed === false).length)
//   });

//   client.send(command);

//   res.send({
//     ip: idleMachine.ip
//   });
// });



// app.post("/destroy", async (req, res) => {
//   const machineId = req.body.machineId;

//   if (!machineId) {
//     return res.status(400).json({ error: "Missing machineId in request body" });
//   }

//   try {
//     const command = new TerminateInstanceInAutoScalingGroupCommand({
//       InstanceId: machineId,
//       ShouldDecrementDesiredCapacity: true,
//     });

//     const response = await client.send(command);
//     res.status(200).json({ message: "Instance termination initiated", response });
//   } catch (error) {
//     console.error("Error terminating instance:", error);
//     res.status(500).json({ error: "Failed to terminate instance" });
//   }
// });

// app.listen(port, () => {
//   console.log(`Example app listening on port ${port}`)
// })

