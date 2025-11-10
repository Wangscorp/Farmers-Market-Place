#!/bin/bash

# Test script to verify cart functionality

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Testing Cart Functionality ===${NC}\n"

# 1. First, try to create a test customer account
echo -e "${YELLOW}1. Creating test customer account...${NC}"
SIGNUP_RESPONSE=$(curl -s -X POST http://localhost:8080/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"testcustomer","email":"test@customer.com","password":"test123","role":"Customer"}')

echo "Signup response: $SIGNUP_RESPONSE"
echo ""

# 2. Now try to login to get a token
echo -e "${YELLOW}2. Logging in as customer...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testcustomer", "password":"test123"}')

echo "Login response: $LOGIN_RESPONSE"

# Extract token from response
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}Failed to get token. Make sure you have a customer account.${NC}"
  echo -e "${YELLOW}Try creating one with:${NC}"
  echo "curl -X POST http://localhost:8080/signup -H 'Content-Type: application/json' -d '{\"username\":\"testcustomer\",\"email\":\"customer@test.com\",\"password\":\"password123\",\"role\":\"Customer\"}'"
  exit 1
fi

echo -e "${GREEN}Token obtained: ${TOKEN:0:20}...${NC}\n"

# 2. Get products to find a valid product_id
echo -e "${YELLOW}2. Getting available products...${NC}"
PRODUCTS=$(curl -s http://localhost:8080/products)
echo "Products: $PRODUCTS"

# Extract first product ID (simple grep, not perfect but works)
PRODUCT_ID=$(echo $PRODUCTS | grep -o '"id":[0-9]*' | head -1 | sed 's/"id"://')

if [ -z "$PRODUCT_ID" ]; then
  echo -e "${RED}No products found. Create a product first.${NC}"
  exit 1
fi

echo -e "${GREEN}Using product_id: $PRODUCT_ID${NC}\n"

# 3. Try to add to cart
echo -e "${YELLOW}3. Adding product to cart...${NC}"
CART_RESPONSE=$(curl -s -X POST http://localhost:8080/cart \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"product_id\":$PRODUCT_ID,\"quantity\":1}")

echo "Cart response: $CART_RESPONSE"

# Check if response contains an id (successful cart addition)
if echo "$CART_RESPONSE" | grep -q '"id"'; then
  echo -e "${GREEN}✓ Successfully added to cart!${NC}"
else
  echo -e "${RED}✗ Failed to add to cart${NC}"
  echo "Response: $CART_RESPONSE"
fi

# 4. Get cart items
echo -e "\n${YELLOW}4. Getting cart items...${NC}"
GET_CART=$(curl -s http://localhost:8080/cart \
  -H "Authorization: Bearer $TOKEN")

echo "Cart items: $GET_CART"

echo -e "\n${YELLOW}=== Test Complete ===${NC}"
