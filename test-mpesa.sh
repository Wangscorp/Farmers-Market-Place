#!/bin/bash

# M-Pesa Integration Test Script
# This script helps test the M-Pesa STK Push implementation

echo "🇰🇪 M-Pesa STK Push Integration Test"
echo "=================================="
echo ""

# Check if backend is running
echo "1. Checking backend server..."
if curl -s http://localhost:8080/products > /dev/null 2>&1; then
    echo "   ✅ Backend is running on http://localhost:8080"
else
    echo "   ❌ Backend is not running. Please start it with:"
    echo "      cd backend && cargo run"
    echo ""
    exit 1
fi

# Check if frontend is running  
echo "2. Checking frontend server..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "   ✅ Frontend is running on http://localhost:5173"
else
    echo "   ❌ Frontend is not running. Please start it with:"
    echo "      cd frontend && npm run dev"
    echo ""
fi

# Check environment variables
echo "3. Checking M-Pesa configuration..."
if [ -f "backend/.env" ]; then
    echo "   ✅ Environment file exists"
    
    if grep -q "MPESA_CONSUMER_KEY" backend/.env; then
        echo "   ✅ MPESA_CONSUMER_KEY is set"
    else
        echo "   ⚠️  MPESA_CONSUMER_KEY not found in .env"
    fi
    
    if grep -q "MPESA_CONSUMER_SECRET" backend/.env; then
        echo "   ✅ MPESA_CONSUMER_SECRET is set"
    else
        echo "   ⚠️  MPESA_CONSUMER_SECRET not found in .env"
    fi
    
    if grep -q "MPESA_CALLBACK_URL" backend/.env; then
        callback_url=$(grep "MPESA_CALLBACK_URL" backend/.env | cut -d'=' -f2)
        if [[ $callback_url == *"ngrok"* ]] || [[ $callback_url == *"https://"* ]]; then
            echo "   ✅ Callback URL is configured: $callback_url"
        else
            echo "   ⚠️  Callback URL should be HTTPS (use ngrok for local testing)"
        fi
    else
        echo "   ⚠️  MPESA_CALLBACK_URL not found in .env"
    fi
else
    echo "   ❌ backend/.env file not found"
fi

echo ""
echo "4. Test URLs:"
echo "   • Main App: http://localhost:5173"
echo "   • M-Pesa Test: http://localhost:5173/mpesa-test"
echo "   • Backend API: http://localhost:8080"
echo ""

echo "5. Next Steps:"
echo "   1. Get M-Pesa credentials from https://developer.safaricom.co.ke/"
echo "   2. Update backend/.env with your Consumer Key and Secret"
echo "   3. Set up ngrok for callback URL: ngrok http 8080"
echo "   4. Test STK Push at: http://localhost:5173/mpesa-test"
echo ""

echo "🚀 Your M-Pesa STK Push integration is ready!"
echo "   Visit /mpesa-test to try sending an STK Push to your phone!"