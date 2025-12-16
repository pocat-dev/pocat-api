# 🎬 Pocat Backend API - Ready for Gemini Integration!

## 🚀 Quick Start
I've built a robust YouTube video download API that's perfect for AI video analysis. Here's what you need to know:

**Live API**: https://nonimitating-corie-extemporary.ngrok-free.dev

## 📋 Simple Usage

### Download Any YouTube Video:
```bash
curl -X POST https://nonimitating-corie-extemporary.ngrok-free.dev/v2/projects \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Video for AI Analysis",
    "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
    "userId": 1,
    "downloader": "yt-dlp"
  }'
```

### Response:
```json
{
  "success": true,
  "data": {
    "projectId": 11,
    "status": "downloading",
    "videoInfo": {
      "title": "Video Title",
      "duration": 1207,
      "author": "Channel Name"
    }
  }
}
```

### Access Downloaded Video:
```
https://nonimitating-corie-extemporary.ngrok-free.dev/storage/downloads/project_11_full.mp4
```

## 🎯 Key Features

✅ **Multiple Quality Options**: 144p to 4K  
✅ **Reliable Downloads**: yt-dlp bypasses YouTube restrictions  
✅ **Public Access**: Videos accessible via direct URLs  
✅ **Fast Processing**: 25-90 MB/s download speeds  
✅ **CORS Enabled**: Ready for web integration  

## 📊 Quality Options

| Quality | File Size | Use Case |
|---------|-----------|----------|
| 360p | 40-80MB | Quick analysis |
| **720p** | **100-200MB** | **Recommended** |
| 1080p | 200-400MB | High quality |
| 4K | 800MB-2GB | Maximum quality |

## 🧪 Test Videos Available Now:
- https://nonimitating-corie-extemporary.ngrok-free.dev/storage/downloads/project_10_full.mp4 (29MB)
- https://nonimitating-corie-extemporary.ngrok-free.dev/storage/downloads/project_11_full.mp4 (131MB)

**Ready to integrate with your AI workflows!** 🤖✨
