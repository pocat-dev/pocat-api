# Downloader Selection API

## Overview
The Pocat API now supports selecting specific YouTube downloader methods for maximum flexibility and reliability.

## Endpoint
```
POST /v2/projects
```

## Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `title` | string | ✅ | - | Project title |
| `youtubeUrl` | string | ✅ | - | YouTube video URL |
| `userId` | number | ✅ | - | User ID |
| `quality` | string | ❌ | `720p` | Video quality preference |
| `downloader` | string | ❌ | `auto` | Downloader method selection |

## Downloader Options

### 1. `auto` (Default)
Uses intelligent fallback system:
1. **yt-dlp** (Primary - Most reliable)
2. **ytdl-core** (Secondary - Backup)
3. **puppeteer** (Final - Last resort)

```bash
curl -X POST http://127.0.0.1:3333/v2/projects \
  -H "Content-Type: application/json" \
  -d '{"title":"Auto Download","youtubeUrl":"https://youtube.com/watch?v=VIDEO_ID","userId":1}'
```

### 2. `yt-dlp` (Recommended)
Direct yt-dlp download - Most reliable for bypassing YouTube restrictions.

```bash
curl -X POST http://127.0.0.1:3333/v2/projects \
  -H "Content-Type: application/json" \
  -d '{"title":"yt-dlp Download","youtubeUrl":"https://youtube.com/watch?v=VIDEO_ID","userId":1,"downloader":"yt-dlp"}'
```

### 3. `ytdl-core`
Direct ytdl-core download - May fail with 403 errors on some videos.

```bash
curl -X POST http://127.0.0.1:3333/v2/projects \
  -H "Content-Type: application/json" \
  -d '{"title":"ytdl-core Download","youtubeUrl":"https://youtube.com/watch?v=VIDEO_ID","userId":1,"downloader":"ytdl-core"}'
```

### 4. `puppeteer`
Direct Puppeteer download - Slowest but can handle complex cases.

```bash
curl -X POST http://127.0.0.1:3333/v2/projects \
  -H "Content-Type: application/json" \
  -d '{"title":"Puppeteer Download","youtubeUrl":"https://youtube.com/watch?v=VIDEO_ID","userId":1,"downloader":"puppeteer"}'
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Project created, video download started using yt-dlp",
  "data": {
    "projectId": 11,
    "title": "Test yt-dlp Direct",
    "status": "downloading",
    "downloader": "yt-dlp",
    "videoInfo": {
      "title": "Video Title",
      "duration": 1207,
      "thumbnail": "https://...",
      "author": "Channel Name",
      "viewCount": "16097"
    },
    "estimatedTime": "2-5 minutes depending on video length"
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Invalid downloader. Must be one of: auto, yt-dlp, ytdl-core, puppeteer"
}
```

## Performance Comparison

| Downloader | Reliability | Speed | YouTube Restrictions |
|------------|-------------|-------|---------------------|
| **yt-dlp** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Bypasses most |
| **ytdl-core** | ⭐⭐ | ⭐⭐⭐⭐ | ❌ Often blocked |
| **puppeteer** | ⭐⭐⭐ | ⭐⭐ | ⚠️ Limited success |

## Recommendations

1. **Use `yt-dlp`** for maximum reliability
2. **Use `auto`** for intelligent fallback
3. **Avoid `ytdl-core`** for new videos (403 errors common)
4. **Use `puppeteer`** only for testing or special cases

## Testing Results

Recent test results with video `Igias7FrhiU`:
- ✅ **yt-dlp**: 131MB downloaded successfully
- ❌ **ytdl-core**: Failed with 403 error
- ✅ **auto**: 131MB downloaded (fell back to yt-dlp)
