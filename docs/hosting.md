# Solo Unicorn Public Hosting Guide

This guide covers setting up public access to your local Solo Unicorn instance using Cloudflare Tunnel while keeping your domain registered on AWS.

## Overview

- **Domain**: `solounicorn.lol` (registered on AWS)
- **Local Services**:
  - Solo Unicorn Web: `localhost:8302`
  - Solo Unicorn API: `localhost:8500`
- **Public URLs**:
  - `https://solounicorn.lol` → Web UI
  - `https://api.solounicorn.lol` → API Server
- **Cost**: ~$0.50/month (AWS Route 53 hosted zone only)

## Prerequisites

- Domain `solounicorn.lol` registered on AWS
- Solo Unicorn running locally on ports 8302 (web) and 8500 (API)
- Cloudflare account (free)

**Note**: Skip this step for now - we'll come back after getting Cloudflare nameservers.

## Part 1: Cloudflare Setup

### 1.1 Add Domain to Cloudflare

1. Log into [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click "Connect a domain"
3. Enter domain: `solounicorn.lol`
4. Select "Free" plan
5. Click "Continue"

### 1.2 Get Cloudflare Nameservers

1. After adding domain, go to Overview, Cloudflare will show nameservers (e.g., `alice.ns.cloudflare.com`)
2. **Copy these nameservers**
3. Go back to AWS Route 53 (Part 2.1) and update domain nameservers
4. Return to Cloudflare and click "Done, check nameservers"

## Part 2: AWS Route 53 Setup

Domain is currently at account Monster Make 124355671028.

### 2.1 Update Domain Nameservers

1. Go to Route 53 → "Registered domains"
2. Click on `solounicorn.lol`
3. Click "Add or edit name servers"
4. Replace existing nameservers with Cloudflare's nameservers (from Part 1.2)
5. Click "Update"

### 2.2 Wait for DNS Propagation

- Wait 15-60 minutes for nameserver changes to propagate
- Cloudflare will verify and activate your domain
- Cloudflare Overview page, Status should change to "Active"

## Part 3: Install Cloudflare Tunnel

### 3.1 Install cloudflared

**On macOS:**
```bash
brew install cloudflared
```

**On Linux/WSL:**
```bash
# Download and install
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

**On Windows:**
```bash
# Download from: https://github.com/cloudflare/cloudflared/releases
# Install the .msi file
```

### 3.2 Authenticate cloudflared

```bash
cloudflared tunnel login
```

This opens browser to authenticate with Cloudflare. Select `solounicorn.lol` domain.

### 3.3 Create Tunnel

```bash
# Create tunnel
cloudflared tunnel create solo-unicorn

# Note the tunnel UUID from output (e.g., 92323cf0-b490-41e1-ae89-3a39575eecc5)
```

## Part 4: Configure Tunnel

### 4.1 Create Configuration File

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: solo-unicorn
credentials-file: ~/.cloudflared/92323cf0-b490-41e1-ae89-3a39575eecc5.json

ingress:
  # Web UI
  - hostname: solounicorn.lol
    service: http://localhost:8302
  # API Server
  - hostname: api.solounicorn.lol
    service: http://localhost:8500
  # Catch-all rule (required)
  - service: http_status:404
```

**Replace the UUID** in `credentials-file` with your actual tunnel UUID.

### 4.2 Create DNS Records

```bash
# Create DNS record for main domain
cloudflared tunnel route dns solo-unicorn solounicorn.lol

# Create DNS record for API subdomain
cloudflared tunnel route dns solo-unicorn api.solounicorn.lol
```

### 4.3 Test Configuration

```bash
# Validate config
cloudflared tunnel ingress validate

# Test tunnel (dry run)
cloudflared tunnel --config ~/.cloudflared/config.yml run solo-unicorn
```

## Part 5: Run Tunnel

### 5.1 Start Tunnel

Make sure Solo Unicorn is running locally:

```bash
# In solo-unicorn directory - start your local servers
cd /home/iw/repos/solo-unicorn
bun dev  # or however you start your services
```

In another terminal:

```bash
# Start tunnel
cloudflared tunnel --config ~/.cloudflared/config.yml run solo-unicorn
```

### 5.2 Verify Access

Test in browser:
- `https://solounicorn.lol` → Should show Solo Unicorn web UI
- `https://api.solounicorn.lol/health` → Should show API response

## Part 6: Run as Service (Optional)

### 6.1 Install as System Service

**On Linux:**
```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

**On macOS:**
```bash
sudo cloudflared service install
sudo launchctl load /Library/LaunchDaemons/com.cloudflare.cloudflared.plist
```

**On Windows:**
```bash
# Run as Administrator
cloudflared service install
```

### 6.2 Check Service Status

```bash
# Linux
sudo systemctl status cloudflared

# macOS
sudo launchctl list | grep cloudflared

# Windows
sc query cloudflared
```

## Part 7: Cloudflare Dashboard Configuration

### 7.1 Configure SSL/TLS

1. Go to Cloudflare Dashboard → SSL/TLS
2. Set encryption mode to "Full" or "Full (strict)"
3. Enable "Always Use HTTPS"

### 7.2 Configure Security (Optional)

1. Go to Security → Settings
2. Set Security Level to "Medium" or "High"
3. Enable "Bot Fight Mode"
4. Configure rate limiting if needed

## Troubleshooting

### Common Issues

**Tunnel not connecting:**
```bash
# Check tunnel status
cloudflared tunnel info solo-unicorn

# Check logs
cloudflared tunnel --config ~/.cloudflared/config.yml run solo-unicorn --loglevel debug
```

**DNS not resolving:**
```bash
# Check DNS propagation
dig solounicorn.lol
nslookup solounicorn.lol
```

**502 Bad Gateway:**
- Verify local services are running on correct ports
- Check firewall settings
- Verify config.yml has correct local URLs

### Log Locations

- Linux: `/var/log/cloudflared.log`
- macOS: `/usr/local/var/log/cloudflared.log`
- Windows: `C:\ProgramData\Cloudflare\cloudflared.log`

## Security Considerations

1. **Local services binding**: Ensure Solo Unicorn only binds to localhost/127.0.0.1
2. **Firewall**: Don't open ports 8302/8500 on your router
3. **Authentication**: Consider adding Cloudflare Access for additional security
4. **Rate limiting**: Configure Cloudflare rate limiting to prevent abuse

## Costs

- **Cloudflare Tunnel**: FREE
- **AWS Route 53 Hosted Zone**: $0.50/month
- **AWS Domain Registration**: ~$12/year (varies by TLD)
- **Total Monthly**: ~$0.50

## Updating Configuration

To modify tunnel configuration:

1. Edit `~/.cloudflared/config.yml`
2. Restart tunnel:
   ```bash
   # If running as service
   sudo systemctl restart cloudflared

   # If running manually
   # Stop current tunnel (Ctrl+C) and restart
   cloudflared tunnel --config ~/.cloudflared/config.yml run solo-unicorn
   ```

## Cleanup

To remove tunnel:

```bash
# Stop service
sudo systemctl stop cloudflared
sudo systemctl disable cloudflared

# Delete tunnel
cloudflared tunnel delete solo-unicorn

# Remove DNS records from Cloudflare dashboard
# Change nameservers back to AWS in Route 53 if desired
```
