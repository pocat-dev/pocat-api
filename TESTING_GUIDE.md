# 🧪 Pocat.io Testing Guide

## 🚀 Local Testing (Tanpa Ngrok)

### 1. Start Development Server
```bash
cd pocat.io
pnpm run dev
```
Server akan berjalan di: `http://localhost:3333`

### 2. Test API Endpoints

#### Basic API Info
```bash
curl http://localhost:3333
```

#### Test YouTube Video Info
```bash
curl "http://localhost:3333/video/info?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

#### Create User
```bash
curl -X POST http://localhost:3333/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
```

#### Create Video Project
```bash
curl -X POST http://localhost:3333/projects \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Test Project",
    "youtubeUrl":"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "userId":1
  }'
```

#### Generate Clips
```bash
curl -X POST http://localhost:3333/projects/1/generate-clips \
  -H "Content-Type: application/json" \
  -d '{"clipDuration":30,"maxClips":3}'
```

## 🌐 Testing dengan Ngrok

### 1. Setup Ngrok (One-time)
```bash
# Sign up di https://dashboard.ngrok.com/signup
# Get authtoken dari https://dashboard.ngrok.com/get-started/your-authtoken

# Install authtoken
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
```

### 2. Start Ngrok Tunnel
```bash
# Terminal 1: Start Pocat.io
cd pocat.io
pnpm run dev

# Terminal 2: Start Ngrok
ngrok http 3333
```

### 3. Get Public URL
Ngrok akan memberikan URL seperti:
```
https://abc123.ngrok-free.app -> http://localhost:3333
```

### 4. Test dengan Public URL
```bash
# Test API
curl https://abc123.ngrok-free.app

# Test video info
curl "https://abc123.ngrok-free.app/video/info?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

## 🎬 Frontend Integration Testing

### Update Frontend BACKEND_URL
```javascript
// Untuk local testing
const BACKEND_URL = 'http://localhost:3333';

// Untuk ngrok testing
const BACKEND_URL = 'https://abc123.ngrok-free.app';
```

### Test Video Streaming
```javascript
// Test streaming endpoint
const streamUrl = `${BACKEND_URL}/stream?url=${encodeURIComponent('https://www.youtube.com/watch?v=dQw4w9WgXcQ')}`;

// Set ke video element
document.getElementById('video-player').src = streamUrl;
```

## 🔧 Alternative Testing Tools

### 1. Localtunnel (Free, No Auth Required)
```bash
# Install
npm install -g localtunnel

# Start tunnel
lt --port 3333 --subdomain pocat-test
```

### 2. Serveo (SSH-based, Free)
```bash
ssh -R 80:localhost:3333 serveo.net
```

### 3. Cloudflare Tunnel (Free)
```bash
# Install cloudflared
# Setup tunnel
cloudflared tunnel --url http://localhost:3333
```

## 📱 Mobile Testing

Dengan ngrok atau alternatif lain, Anda bisa test dari:
- Mobile browser
- Postman mobile
- Frontend app di device lain

## 🐛 Debugging Tips

### Check Server Logs
```bash
# Lihat logs real-time
tail -f pocat.io/server.log

# Check server status
curl -I http://localhost:3333
```

### Common Issues
1. **CORS Error**: Sudah dikonfigurasi, tapi pastikan frontend menggunakan URL yang benar
2. **YouTube URL Invalid**: Pastikan URL format yang benar
3. **Database Error**: Jalankan `pnpm run ace migrate:turso` jika ada error database

## 🎯 Production Testing Checklist

- [ ] API endpoints respond correctly
- [ ] YouTube video streaming works
- [ ] Video info extraction works
- [ ] Project creation works
- [ ] Clip generation works
- [ ] CORS headers correct
- [ ] Error handling proper
- [ ] Database operations successful

## 📊 Performance Testing

### Load Testing dengan curl
```bash
# Test multiple requests
for i in {1..10}; do
  curl -s http://localhost:3333 &
done
wait
```

### Monitor Resource Usage
```bash
# Check memory/CPU usage
htop

# Check port usage
netstat -tulpn | grep 3333
```

Pocat.io siap untuk testing dengan berbagai metode! 🚀
