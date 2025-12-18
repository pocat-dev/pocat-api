import ytdl from '@distube/ytdl-core'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'
import db from '@adonisjs/lucid/services/db'
import { YtDlpDownloader } from './yt_dlp_downloader.js'
import videoReferenceService from './video_reference_service.js'
// import puppeteerDownloader from './puppeteer_youtube_downloader.js' // TODO: Implement later

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
  private downloadProgress = new Map<number, {progress: number, status: string, startTime: Date}>()

  constructor() {
    // Ensure directories exist
    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath, { recursive: true })
    }
    ffmpeg.setFfmpegPath('/usr/bin/ffmpeg')
  }

  // Update progress for a project
  private updateProgress(projectId: number, progress: number, status: string) {
    this.downloadProgress.set(projectId, {
      progress: Math.round(progress),
      status,
      startTime: this.downloadProgress.get(projectId)?.startTime || new Date()
    })
    console.log(`📊 Project ${projectId}: ${progress}% - ${status}`)
  }

  // Initialize progress tracking
  private initializeProgress(projectId: number) {
    this.updateProgress(projectId, 0, 'initializing')
  }

  // Complete progress tracking
  private completeProgress(projectId: number) {
    this.updateProgress(projectId, 100, 'completed')
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
      this.initializeProgress(projectId)
      
      // Check if video already exists in downloads
      this.updateProgress(projectId, 10, 'checking existing files')
      const existingVideo = videoReferenceService.findExistingVideo(youtubeUrl, quality, true)
      if (existingVideo) {
        if (existingVideo.type === 'master') {
          console.log(`🎯 Video completed! Creating reference to: ${existingVideo.path}`)
          
          this.updateProgress(projectId, 50, 'creating reference')
          
          // Create JSON reference instead of copying file
          const referencePath = await videoReferenceService.createReference(
            projectId,
            youtubeUrl,
            quality,
            true,
            existingVideo.path,
            { title: 'Referenced Video', duration: 0 }
          )
          
          this.updateProgress(projectId, 90, 'finalizing reference')
          
          // Return path to actual video file (not reference)
          const actualVideoPath = videoReferenceService.getVideoFilePath(projectId)
        
          this.completeProgress(projectId)
          
          return {
            success: true,
            message: 'Video reference created from existing file',
            videoPath: actualVideoPath
          }
        } else if (existingVideo.type === 'downloading') {
          console.log(`⏳ Video downloading! Sharing progress for project ${projectId}`)
          // Don't start new download, just track progress of existing one
          this.updateProgress(projectId, 50, 'sharing download progress')
          return { success: true, message: 'Sharing existing download progress' }
        }
      }
      
      console.log(`💾 No existing video found. Downloading fresh copy...`)
      this.updateProgress(projectId, 20, 'starting fresh download')
      
      // Try yt-dlp first (most reliable)
      try {
        const result = await this.tryYtDlpDownload(youtubeUrl, projectId, quality)
        
        if (result.success && result.filePath) {
          console.log(`✅ Downloaded fresh video: ${result.filePath}`)
          this.completeProgress(projectId)
          return {
            ...result,
            metadata: { ...result.metadata, source: 'fresh_download' }
          }
        }
        
        return result
      } catch (ytdlpError) {
        console.log(`❌ yt-dlp failed: ${ytdlpError.message}`)
        this.updateProgress(projectId, 30, 'yt-dlp failed, trying ytdl-core')
      }

      // Fallback to ytdl-core
      try {
        const result = await this.tryYtdlCoreDownload(youtubeUrl, projectId, quality)
        
        if (result.success && result.filePath) {
          console.log(`✅ Downloaded via ytdl-core: ${result.filePath}`)
          this.completeProgress(projectId)
          return {
            ...result,
            metadata: { ...result.metadata, source: 'fresh_download' }
          }
        }
        
        return result
      } catch (ytdlError) {
        console.log(`❌ ytdl-core failed: ${ytdlError.message}`)
        this.updateProgress(projectId, 50, 'ytdl-core failed, trying puppeteer')
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
  async tryYtDlpDownload(youtubeUrl: string, projectId: number, quality: string) {
    const ytDlp = new YtDlpDownloader()
    
    try {
      console.log(`🚀 Trying yt-dlp download...`)
      this.updateProgress(projectId, 25, 'getting video info')
      
      // Get video info first
      const info = await ytDlp.getVideoInfo(youtubeUrl)
      
      this.updateProgress(projectId, 40, 'starting video download')
      
      // Extract video ID for consistent naming
      const videoId = this.extractVideoId(youtubeUrl)
      const filename = `${videoId}_${quality}_true`
      
      this.updateProgress(projectId, 60, 'downloading video data')
      const filePath = await ytDlp.downloadVideo(youtubeUrl, filename)
      
      this.updateProgress(projectId, 90, 'processing video file')
      
      // Verify file actually exists and is complete (no .part files)
      if (videoId) {
        const partFiles = this.checkForPartFiles(videoId)
        if (partFiles.length > 0) {
          throw new Error('Download incomplete - .part files still exist')
        }
        
        if (!fs.existsSync(filePath)) {
          throw new Error('Downloaded file not found')
        }
        
        const stats = fs.statSync(filePath)
        if (stats.size === 0) {
          throw new Error('Downloaded file is empty')
        }
      }
      
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
  async tryYtdlCoreDownload(youtubeUrl: string, projectId: number, quality: string) {
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

  // Final fallback method using Puppeteer (commented out - not implemented yet)
  async tryPuppeteerDownload(youtubeUrl: string, projectId: number, quality: string) {
    /*
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
    */
    
    // For now, return failure since puppeteer is not implemented
    return {
      success: false,
      error: 'Puppeteer downloader not implemented yet'
    }
  }

  // Step 2: Stream video for frontend editing (chunked streaming)
  async streamVideoForEditing(projectId: number, startByte: number = 0, endByte?: number) {
    const videoPath = await this.getVideoFilePath(projectId)
    
    if (!videoPath) {
      throw new Error('Video not found for project')
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

  // Check if video is downloaded (check direct file or reference)
  async isVideoDownloaded(projectId: number): Promise<boolean> {
    return videoReferenceService.hasVideo(projectId)
  }

  // Get actual video file path (resolve references)
  async getVideoFilePath(projectId: number): Promise<string | null> {
    return await videoReferenceService.getVideoFilePath(projectId)
  }

  private extractVideoId(youtubeUrl: string): string {
    const match = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
    return match ? match[1] : `video_${Date.now()}`
  }

  // Get real-time download progress
  async getDownloadProgress(projectId: number): Promise<{ progress: number, status: string }> {
    // Check actual file status first
    const videoId = await this.extractVideoIdFromProject(projectId)
    if (videoId) {
      const finalFile = path.join(this.downloadPath, `${videoId}_720p_true.mp4`)
      const partFiles = this.checkForPartFiles(videoId)
      
      if (partFiles.length > 0) {
        // Still downloading - calculate real progress from file size
        const progress = this.calculateDownloadProgress(videoId)
        return { progress: Math.min(progress, 95), status: 'downloading' }
      } else if (fs.existsSync(finalFile)) {
        // Download completed
        return { progress: 100, status: 'completed' }
      }
    }
    
    // Fallback to memory progress
    const progressData = this.downloadProgress.get(projectId)
    if (progressData) {
      return {
        progress: progressData.progress,
        status: progressData.status
      }
    }
    
    // Default
    return { progress: 0, status: 'pending' }
  }

  private calculateDownloadProgress(videoId: string): number {
    try {
      const partFiles = this.checkForPartFiles(videoId)
      if (partFiles.length === 0) return 100
      
      // Simple progress based on part file existence
      // TODO: Calculate actual progress from file sizes
      return 50 // Placeholder - downloading in progress
    } catch (error) {
      return 0
    }
  }

  // Resume incomplete download
  async resumeDownload(projectId: number): Promise<{ success: boolean, filePath?: string, error?: string }> {
    try {
      const videoId = await this.extractVideoIdFromProject(projectId)
      if (!videoId) {
        return { success: false, error: 'Video ID not found for project' }
      }

      const partFiles = this.checkForPartFiles(videoId)
      if (partFiles.length === 0) {
        return { success: false, error: 'No incomplete download found' }
      }

      console.log(`🔄 Resuming download for project ${projectId}, videoId: ${videoId}`)
      
      // Get project details from database
      const project = await db.from('video_projects').where('id', projectId).first()
      if (!project) {
        return { success: false, error: 'Project not found' }
      }

      // Clean up old part files and restart download
      this.cleanupPartFiles(videoId)
      
      // Restart download with same parameters
      const result = await this.downloadVideo(project.youtube_url, projectId, '720p')
      
      return result
    } catch (error) {
      console.error(`❌ Resume download failed for project ${projectId}:`, error)
      return { success: false, error: error.message }
    }
  }

  // Clean up stuck part files
  private cleanupPartFiles(videoId: string): void {
    try {
      const files = fs.readdirSync(this.downloadPath)
      const partFiles = files.filter(file => 
        file.includes(videoId) && (file.endsWith('.part') || file.endsWith('.ytdl'))
      )
      
      partFiles.forEach(file => {
        const filePath = path.join(this.downloadPath, file)
        fs.unlinkSync(filePath)
        console.log(`🗑️ Cleaned up: ${file}`)
      })
    } catch (error) {
      console.error('Error cleaning up part files:', error)
    }
  }

  // Check for stuck downloads and auto-resume
  async checkAndResumeStuckDownloads(): Promise<void> {
    try {
      const files = fs.readdirSync(this.downloadPath)
      const partFiles = files.filter(file => file.endsWith('.part'))
      
      for (const partFile of partFiles) {
        const filePath = path.join(this.downloadPath, partFile)
        const stats = fs.statSync(filePath)
        const ageMinutes = (Date.now() - stats.mtime.getTime()) / (1000 * 60)
        
        // If part file hasn't been modified for 5+ minutes, consider it stuck
        if (ageMinutes > 5) {
          const videoId = partFile.split('_')[0]
          console.log(`⚠️ Detected stuck download: ${videoId} (${ageMinutes.toFixed(1)} min old)`)
          
          // Find project with this video ID
          const project = await db.from('video_projects')
            .whereRaw('youtube_url LIKE ?', [`%${videoId}%`])
            .andWhere('status', 'processing')
            .first()
            
          if (project) {
            console.log(`🔄 Auto-resuming stuck download for project ${project.id}`)
            await this.resumeDownload(project.id)
          }
        }
      }
    } catch (error) {
      console.error('Error checking stuck downloads:', error)
    }
  }

  private checkForPartFiles(videoId: string): string[] {
    try {
      const files = fs.readdirSync(this.downloadPath)
      return files.filter(file => 
        file.includes(videoId) && (file.endsWith('.part') || file.endsWith('.ytdl'))
      )
    } catch (error) {
      return []
    }
  }

  private extractVideoIdFromUrl(youtubeUrl: string): string | null {
    const match = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
    return match ? match[1] : null
  }

  private async extractVideoIdFromProject(projectId: number): Promise<string | null> {
    try {
      // Query database for project's YouTube URL
      const project = await db.from('video_projects').where('id', projectId).first()
      
      if (project && project.youtube_url) {
        // Extract video ID from YouTube URL
        const match = project.youtube_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
        if (match) return match[1]
      }
    } catch (error) {
      console.log('Database query failed, trying file system fallback')
    }
    
    // Fallback: Try to find video ID from existing files
    try {
      const files = fs.readdirSync(this.downloadPath)
      for (const file of files) {
        if (file.includes('_720p_true') && (file.endsWith('.mp4') || file.endsWith('.part'))) {
          const match = file.match(/^([^_]+)_720p_true/)
          if (match) return match[1]
        }
      }
    } catch (error) {
      // Ignore
    }
    return null
  }
}

// Named export for testing
export { EnhancedVideoProcessor }

// Default export for application use
export default new EnhancedVideoProcessor()
