#!/bin/bash

# =============================================================================
# SICATA Full Deployment Script
# Deploys both backend and frontend to VPS
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=========================================="
echo "SICATA Full Deployment"
echo "==========================================${NC}"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Deploy backend
echo ""
echo -e "${YELLOW}Deploying Backend...${NC}"
bash "${SCRIPT_DIR}/deploy-backend.sh"

# Deploy frontend
echo ""
echo -e "${YELLOW}Deploying Frontend...${NC}"
bash "${SCRIPT_DIR}/deploy-frontend.sh"

echo ""
echo -e "${GREEN}=========================================="
echo "Full Deployment Complete!"
echo "=========================================="
echo ""
echo "Access your application at:"
echo "  https://148.230.99.31"
echo ""
echo "Both frontend and backend are served through"
echo "nginx on port 443 (HTTPS)."
echo ""
echo "Note: First visit will show a self-signed"
echo "certificate warning. Click 'Advanced' →"
echo "'Proceed' to continue."
echo "==========================================${NC}"
