# 🎬 Pocat.io Frontend Integration Guide

## Backend API Endpoints untuk Frontend

### Base URL
```
Development: http://localhost:3333
Production: http://YOUR_VPS_IP:3333
```

## 📺 YouTube Video Streaming

### 1. Stream YouTube Video
```
GET /stream?url=YOUTUBE_URL
```

**Example:**
```javascript
// Frontend code untuk streaming video
const BACKEND_URL = 'http://localhost:3333'; // Ganti dengan IP VPS Anda

function streamYouTubeVideo(youtubeUrl) {
  const streamUrl = `${BACKEND_URL}/stream?url=${encodeURIComponent(youtubeUrl)}`;
  
  // Set ke video element
  const videoElement = document.getElementById('video-player');
  videoElement.src = streamUrl;
}

// Usage
streamYouTubeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
```

### 2. Get YouTube Video Info
```
GET /video/info?url=YOUTUBE_URL
```

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "Video Title",
    "duration": "300",
    "thumbnail": "https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg",
    "description": "Video description...",
    "author": "Channel Name",
    "viewCount": "1000000"
  }
}
```

**Example:**
```javascript
async function getVideoInfo(youtubeUrl) {
  try {
    const response = await fetch(`${BACKEND_URL}/video/info?url=${encodeURIComponent(youtubeUrl)}`);
    const data = await response.json();
    
    if (data.success) {
      console.log('Video Info:', data.data);
      return data.data;
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## 👥 User Management API

### Create User
```
POST /users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com", 
  "password": "password123"
}
```

### Get All Users
```
GET /users
```

### Get User by ID
```
GET /users/:id
```

### Update User
```
PUT /users/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "email": "updated@example.com"
}
```

### Delete User
```
DELETE /users/:id
```

## 🔧 React/Vue/Angular Integration Example

### React Component Example
```jsx
import React, { useState, useRef } from 'react';

const VideoPlayer = () => {
  const [videoInfo, setVideoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);
  
  const BACKEND_URL = 'http://localhost:3333'; // Update dengan IP VPS Anda

  const handleYouTubeImport = async (youtubeUrl) => {
    setLoading(true);
    
    try {
      // Get video info first
      const infoResponse = await fetch(`${BACKEND_URL}/video/info?url=${encodeURIComponent(youtubeUrl)}`);
      const infoData = await infoResponse.json();
      
      if (infoData.success) {
        setVideoInfo(infoData.data);
        
        // Set video source untuk streaming
        const streamUrl = `${BACKEND_URL}/stream?url=${encodeURIComponent(youtubeUrl)}`;
        if (videoRef.current) {
          videoRef.current.src = streamUrl;
        }
      }
    } catch (error) {
      console.error('Error importing YouTube video:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {videoInfo && (
        <div>
          <h3>{videoInfo.title}</h3>
          <p>By: {videoInfo.author}</p>
          <p>Duration: {videoInfo.duration}s</p>
        </div>
      )}
      
      <video 
        ref={videoRef}
        controls 
        width="100%" 
        height="400"
        style={{ backgroundColor: '#000' }}
      >
        Your browser does not support the video tag.
      </video>
      
      {loading && <p>Loading video...</p>}
    </div>
  );
};

export default VideoPlayer;
```

## 🚀 Deployment di VPS

### 1. Upload ke VPS
```bash
# Di VPS
git clone YOUR_REPO
cd pocat.io
pnpm install
```

### 2. Build & Run Production
```bash
# Build
pnpm run build

# Install production dependencies
cd build
pnpm i --prod

# Run dengan PM2
pm2 start bin/server.js --name "pocat-api"
pm2 startup
pm2 save
```

### 3. Nginx Reverse Proxy (Optional)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3333;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔒 CORS Configuration

Backend sudah dikonfigurasi untuk menerima request dari semua origin. Untuk production, update `config/cors.ts`:

```typescript
const corsConfig = defineConfig({
  enabled: true,
  origin: ['https://your-frontend-domain.com'], // Ganti dengan domain frontend Anda
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'],
  headers: true,
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})
```

## 📝 Notes untuk Frontend Developer

1. **Port**: Backend berjalan di port 3333 (bukan 3000)
2. **CORS**: Sudah dikonfigurasi untuk development
3. **Video Format**: Stream menggunakan format MP4 360p untuk performa optimal
4. **Error Handling**: Semua endpoint mengembalikan format JSON yang konsisten
5. **Rate Limiting**: Belum diimplementasi, pertimbangkan untuk production

## 🎯 Next Steps

Setelah integrasi dasar berfungsi, kita bisa menambahkan:
- Video transcription dengan AI
- Automatic clip generation
- Subtitle generation
- Video analysis & highlights detection
- User authentication & authorization
