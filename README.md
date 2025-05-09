# 🧠 Replit-like Code Execution Environment on AWS

This project sets up a secure, scalable, and isolated code execution environment similar to [Replit](https://replit.com/). Each user is assigned a dedicated EC2 instance to ensure privacy, performance, and sandboxed execution.

---

## 🚀 Key Features

- **Isolated Environments**: Each user receives a dedicated EC2 instance.
- **Custom AMIs**: Pre-configured Amazon Machine Images with all required runtimes.
- **Launch Template**: Automates EC2 provisioning with consistent settings.
- **Auto Scaling Group**: Dynamically provisions or terminates instances based on demand.
- **Docker-based Execution**: Uses Docker containers to manage runtime environments.
- **Secure by Design**: Completely isolated VMs per user ensure secure execution.

---

## 🏗️ AWS Infrastructure

- **EC2 Instances**: One per user, provisioned on demand.
- **Custom AMIs**: Includes all tools and dependencies for code execution.
- **Launch Template**: Simplifies EC2 configuration and bootstrapping.
- **Auto Scaling Group**: Automatically scales instances up/down based on usage.
- **User Data Script**: Configures and boots the environment upon instance startup.

---

## 🧑‍💻 IAM User Setup

To manage EC2 and Auto Scaling services securely, create an IAM user with limited permissions:

### 🔐 Create IAM User with Limited Permissions

1. Go to the **IAM** section in the AWS Console.
2. Click **Users** > **Add users**.
3. Choose a username (e.g., `ec2-runner`) and enable **Programmatic access**.
4. Attach the following permissions:
   - `AmazonEC2FullAccess`
   - `AutoScalingFullAccess`
5. Complete the creation process and save the access keys securely.

This IAM user will be able to manage EC2 instances and Auto Scaling Groups but will have no access to other AWS services.

---

## 📜 EC2 User Data Script

```bash
#!/bin/bash

# Log everything
exec > /var/log/user-data.log 2>&1
set -e

echo "🚀 Starting EC2 user-data script..."

# Navigate to the project directory
if [ -d "/home/ubuntu/mobile-megic" ]; then
  cd /home/ubuntu/mobile-megic
  echo "✅ Changed directory to /home/ubuntu/mobile-megic"
else
  echo "❌ Directory '/home/ubuntu/mobile-megic' does not exist"
  exit 1
fi

# Install Docker if not present
if ! command -v docker >/dev/null 2>&1; then
  echo "🔧 Installing Docker..."
  sudo apt update
  sudo apt install -y docker.io
  sudo systemctl enable docker
  sudo systemctl start docker
else
  echo "✅ Docker is already installed"
fi

# Check Docker image
if ! sudo docker image inspect code-server-update >/dev/null 2>&1; then
  echo "❌ Docker image 'code-server' not found. Please ensure it is built or pulled before running."
  exit 1
fi

# Run the container
echo "🐳 Running Docker container..."
sudo docker run -d -p 8080:8080 code-server-update

echo "✅ Setup completed"
