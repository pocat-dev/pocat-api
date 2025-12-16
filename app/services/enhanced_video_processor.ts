import ytdl from '@distube/ytdl-core'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'
import { YtDlpDownloader } from './yt_dlp_downloader.js'
import puppeteerDownloader from './puppeteer_youtube_downloader.js'

interface VideoQuality {
  quality: string
  format: string
  filesize?: number
}

interface ClipRequest {
  startTime: number
  endTime: number
  title: string
  aspectRatio: string
}

class EnhancedVideoProcessor {
  private storagePath = path.join(process.cwd(), 'storage')
  private downloadPath = path.join(this.storagePath, 'downloads')

  constructor() {
    // Ensure directories exist
    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath, { recursive: true })
    }
    ffmpeg.setFfmpegPath('/usr/bin/ffmpeg')
  }

  // Step 1: Download full video with quality selection
  async downloadVideo(youtubeUrl: string, projectId: number, quality: string = '720p'): Promise<{
    success: boolean
    filePath?: string
    duration?: number
    metadata?: any
    error?: string
  }> {
    try {
      console.log(`📥 Starting download for project ${projectId}`)
      
      // Try yt-dlp first (most reliable)
      try {
        return await this.tryYtDlpDownload(youtubeUrl, projectId, quality)
      } catch (ytdlpError) {
        console.log(`❌ yt-dlp failed: ${ytdlpError.message}`)
      }

      // Fallback to ytdl-core
      try {
        return await this.tryYtdlCoreDownload(youtubeUrl, projectId, quality)
      } catch (ytdlError) {
        console.log(`❌ ytdl-core failed: ${ytdlError.message}`)
      }

      // Final fallback to Puppeteer
      return await this.tryPuppeteerDownload(youtubeUrl, projectId, quality)

    } catch (error) {
      console.error(`❌ Download failed for project ${projectId}:`, error.message)
      return {
        success: false,
        error: `Download failed: ${error.message}`
      }
    }
  }

  // Primary method using yt-dlp (most reliable)
  private async tryYtDlpDownload(youtubeUrl: string, projectId: number, quality: string) {
    const ytDlp = new YtDlpDownloader()
    
    try {
      console.log(`🚀 Trying yt-dlp download...`)
      
      // Get video info first
      const info = await ytDlp.getVideoInfo(youtubeUrl)
      
      // Download video
      const filename = `project_${projectId}_full`
      const filePath = await ytDlp.downloadVideo(youtubeUrl, filename)
      
      return {
        success: true,
        filePath,
        duration: info.duration,
        metadata: {
          title: info.title,
          author: info.uploader,
          description: info.description,
          thumbnail: info.thumbnail
        }
      }
    } catch (error) {
      throw new Error(`yt-dlp download failed: ${error.message}`)
    }
  }

  // Fallback method using ytdl-core
  private async tryYtdlCoreDownload(youtubeUrl: string, projectId: number, quality: string) {
    try {
      console.log(`🎯 Trying ytdl-core download...`)
      
      const info = await ytdl.getInfo(youtubeUrl)
      const videoPath = path.join(this.downloadPath, `project_${projectId}_full.mp4`)
      
      let format
      try {
        format = ytdl.chooseFormat(info.formats, { 
          quality: this.mapQuality(quality),
          filter: 'audioandvideo'
        })
      } catch (e) {
        format = ytdl.chooseFormat(info.formats, { filter: 'audioandvideo' })
      }

      return new Promise((resolve, reject) => {
        const stream = ytdl(youtubeUrl, { format })
        const writeStream = fs.createWriteStream(videoPath)
        
        stream.pipe(writeStream)
        
        writeStream.on('finish', () => {
          const stats = fs.statSync(videoPath)
          if (stats.size === 0) {
            reject(new Error('Downloaded file is empty'))
            return
          }
          
          resolve({
            success: true,
            filePath: videoPath,
            duration: parseInt(info.videoDetails.lengthSeconds),
            metadata: {
              title: info.videoDetails.title,
              author: info.videoDetails.author.name,
              description: info.videoDetails.description,
              thumbnail: info.videoDetails.thumbnails?.[0]?.url
            }
          })
        })
        
        stream.on('error', reject)
        writeStream.on('error', reject)
      })
    } catch (error) {
      throw new Error(`ytdl-core download failed: ${error.message}`)
    }
  }

  // Final fallback method using Puppeteer
  private async tryPuppeteerDownload(youtubeUrl: string, projectId: number, quality: string) {
    try {
      console.log(`🎭 Trying Puppeteer download...`)
      const result = await puppeteerDownloader.downloadVideo(youtubeUrl, projectId, quality)
      
      if (result.success) {
        // Get video info for metadata
        const infoResult = await puppeteerDownloader.getVideoInfo(youtubeUrl)
        
        return {
          success: true,
          filePath: result.filePath,
          duration: infoResult.data?.duration || 0,
          metadata: infoResult.data || {}
        }
      } else {
        return {
          success: false,
          error: `Both ytdl-core and Puppeteer failed: ${result.error}`
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Puppeteer fallback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  // Step 2: Stream video for frontend editing (chunked streaming)
  async streamVideoForEditing(projectId: number, startByte: number = 0, endByte?: number) {
    const videoPath = path.join(this.downloadPath, `project_${projectId}_full.mp4`)
    
    if (!fs.existsSync(videoPath)) {
      throw new Error('Video not downloaded yet')
    }

    const stat = fs.statSync(videoPath)
    const fileSize = stat.size
    
    const start = startByte
    const end = endByte || fileSize - 1
    
    return {
      stream: fs.createReadStream(videoPath, { start, end }),
      contentLength: end - start + 1,
      totalSize: fileSize,
      contentRange: `bytes ${start}-${end}/${fileSize}`
    }
  }

  // Step 3: Batch clip processing from AI timestamps
  async batchProcessClips(projectId: number, clipRequests: ClipRequest[]): Promise<{
    success: boolean
    clips: Array<{
      id: string
      title: string
      outputPath: string
      status: 'completed' | 'failed'
      error?: string
    }>
  }> {
    const videoPath = path.join(this.downloadPath, `project_${projectId}_full.mp4`)
    
    if (!fs.existsSync(videoPath)) {
      throw new Error('Source video not found')
    }

    const results = []
    
    // Process clips in parallel (but limit concurrency)
    const concurrency = 3
    for (let i = 0; i < clipRequests.length; i += concurrency) {
      const batch = clipRequests.slice(i, i + concurrency)
      const batchPromises = batch.map(clip => this.processSingleClip(videoPath, clip, projectId))
      const batchResults = await Promise.allSettled(batchPromises)
      
      batchResults.forEach((result, index) => {
        const clip = batch[index]
        if (result.status === 'fulfilled') {
          results.push({
            id: `clip_${Date.now()}_${i + index}`,
            title: clip.title,
            outputPath: result.value,
            status: 'completed' as const
          })
        } else {
          results.push({
            id: `clip_${Date.now()}_${i + index}`,
            title: clip.title,
            outputPath: '',
            status: 'failed' as const,
            error: result.reason?.message || 'Unknown error'
          })
        }
      })
    }

    return {
      success: true,
      clips: results
    }
  }

  // Helper: Process single clip
  private async processSingleClip(sourcePath: string, clip: ClipRequest, projectId: number): Promise<string> {
    const clipId = `${projectId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const outputPath = path.join(this.storagePath, 'clips', `${clipId}.mp4`)
    
    const [width, height] = clip.aspectRatio.split(':').map(Number)
    const cropFilter = this.getCropFilter(width, height)

    return new Promise((resolve, reject) => {
      ffmpeg(sourcePath)
        .setStartTime(clip.startTime)
        .setDuration(clip.endTime - clip.startTime)
        .videoFilters(cropFilter)
        .videoCodec('libx264')
        .audioCodec('aac')
        .format('mp4')
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run()
    })
  }

  // Helper: Map quality preferences
  private mapQuality(quality: string): string {
    const qualityMap = {
      '1080p': '137',
      '720p': '136', 
      '480p': '135',
      '360p': '18',
      '240p': '133'
    }
    return qualityMap[quality] || '18'
  }

  // Helper: Generate crop filter
  private getCropFilter(targetWidth: number, targetHeight: number): string {
    if (targetWidth === 9 && targetHeight === 16) {
      return 'crop=ih*9/16:ih:(iw-ih*9/16)/2:0'
    } else if (targetWidth === 16 && targetHeight === 9) {
      return 'scale=1280:720'
    } else if (targetWidth === 1 && targetHeight === 1) {
      return 'crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2'
    }
    return `scale=${targetWidth * 80}:${targetHeight * 80}`
  }

  // Get video info without downloading
  async getVideoInfo(youtubeUrl: string) {
    try {
      const info = await ytdl.getInfo(youtubeUrl)
      const formats = info.formats
        .filter(f => f.hasAudio && f.hasVideo)
        .map(f => ({
          quality: f.qualityLabel || f.quality,
          format: f.container,
          filesize: f.contentLength
        }))

      return {
        success: true,
        data: {
          title: info.videoDetails.title,
          duration: parseInt(info.videoDetails.lengthSeconds),
          thumbnail: info.videoDetails.thumbnails[0]?.url,
          author: info.videoDetails.author.name,
          viewCount: info.videoDetails.viewCount,
          availableQualities: formats
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Check if video is downloaded
  isVideoDownloaded(projectId: number): boolean {
    const videoPath = path.join(this.downloadPath, `project_${projectId}_full.mp4`)
    return fs.existsSync(videoPath)
  }

  // Get download progress (placeholder for future implementation)
  getDownloadProgress(projectId: number): { progress: number, status: string } {
    // This would be implemented with actual progress tracking
    return { progress: 100, status: 'completed' }
  }
}

export default new EnhancedVideoProcessor()
