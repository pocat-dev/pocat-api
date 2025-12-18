import type { HttpContext } from '@adonisjs/core/http'
import VideoProject from '#models/video_project'
import enhancedVideoProcessor from '#services/enhanced_video_processor'
import videoReferenceService from '#services/video_reference_service'
import databaseService from '#services/database_service'
import env from '#start/env'

export default class EnhancedProjectsController {
  // Step 1: Create project and start video download
  async create({ request, response }: HttpContext) {
    try {
      const { title, youtubeUrl, userId, quality = '720p', downloader = 'auto' } = request.only([
        'title', 'youtubeUrl', 'userId', 'quality', 'downloader'
      ])

      if (!title || !youtubeUrl || !userId) {
        return response.status(400).json({
          success: false,
          message: 'Title, YouTube URL, and User ID are required'
        })
      }

      // Validate downloader method
      const validDownloaders = ['auto', 'yt-dlp', 'ytdl-core', 'puppeteer']
      if (!validDownloaders.includes(downloader)) {
        return response.status(400).json({
          success: false,
          message: `Invalid downloader. Must be one of: ${validDownloaders.join(', ')}`
        })
      }

      // Set CORS headers
      response.header('Access-Control-Allow-Origin', '*')

      // Get video info first
      const videoInfo = await enhancedVideoProcessor.getVideoInfo(youtubeUrl)
      
      if (!videoInfo.success) {
        return response.status(400).json({
          success: false,
          message: 'Failed to get video info',
          error: videoInfo.error
        })
      }

      // Create project in database using Lucid ORM
      const project = await VideoProject.create({
        userId: userId,
        title: title,
        youtubeUrl: youtubeUrl,
        videoMetadata: JSON.stringify(videoInfo.data),
        duration: parseInt(videoInfo.data.duration),
        thumbnailUrl: videoInfo.data.thumbnail,
        status: 'processing'  // Use valid status from model
      })

      const projectId = project.id

      // Start download in background with selected downloader
      this.downloadVideoAsync(projectId, youtubeUrl, quality, downloader)

      return response.status(201).json({
        success: true,
        message: `Project created, video download started using ${downloader}`,
        data: {
          projectId,
          title,
          status: 'downloading',
          downloader: downloader,
          videoInfo: videoInfo.data,
          estimatedTime: '2-5 minutes depending on video length'
        }
      })

    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to create project',
        error: error.message
      })
    }
  }

  // Step 2: Check download status
  async downloadStatus({ params, response }: HttpContext) {
    try {
      const { projectId } = params
      
      response.header('Access-Control-Allow-Origin', '*')

      // Check database status using Lucid ORM
      const project = await VideoProject.find(projectId)

      if (!project) {
        return response.status(404).json({
          success: false,
          message: 'Project not found'
        })
      }

      const isDownloaded = await enhancedVideoProcessor.isVideoDownloaded(projectId)
      const progress = await enhancedVideoProcessor.getDownloadProgress(projectId)

      return response.json({
        success: true,
        message: 'Status updated',
        data: {
          readyForEditing: isDownloaded && progress.progress === 100,
          status: progress.status,
          progress: progress.progress,
          video: {
            source: isDownloaded ? 'cached' : 'pending'
          }
        }
      })

    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to check download status',
        error: error.message
      })
    }
  }

  // Step 3: Stream video for frontend editing
  async streamForEditing({ params, request, response }: HttpContext) {
    try {
      const { projectId } = params
      const range = request.header('range')

      response.header('Access-Control-Allow-Origin', '*')
      response.header('Accept-Ranges', 'bytes')

      if (!enhancedVideoProcessor.isVideoDownloaded(projectId)) {
        return response.status(404).json({
          success: false,
          message: 'Video not downloaded yet'
        })
      }

      let startByte = 0
      let endByte: number | undefined

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-')
        startByte = parseInt(parts[0], 10)
        endByte = parts[1] ? parseInt(parts[1], 10) : undefined
      }

      const streamData = await enhancedVideoProcessor.streamVideoForEditing(
        projectId, startByte, endByte
      )

      response.header('Content-Length', streamData.contentLength.toString())
      response.header('Content-Range', streamData.contentRange)
      response.header('Content-Type', 'video/mp4')
      
      if (range) {
        response.status(206) // Partial Content
      }

      return response.stream(streamData.stream)

    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to stream video',
        error: error.message
      })
    }
  }

  // Step 4: Batch process clips from AI analysis
  async batchProcessClips({ params, request, response }: HttpContext) {
    try {
      const { projectId } = params
      const { clips } = request.only(['clips'])

      if (!clips || !Array.isArray(clips)) {
        return response.status(400).json({
          success: false,
          message: 'Clips array is required'
        })
      }

      response.header('Access-Control-Allow-Origin', '*')

      if (!enhancedVideoProcessor.isVideoDownloaded(projectId)) {
        return response.status(400).json({
          success: false,
          message: 'Video must be downloaded first'
        })
      }

      // Update project status using database service
      await databaseService.execute(`
        UPDATE video_projects SET status = 'processing_clips', updated_at = datetime('now') 
        WHERE id = ?
      `, [projectId])

      // Start batch processing
      this.batchProcessAsync(projectId, clips)

      return response.json({
        success: true,
        message: 'Batch clip processing started',
        data: {
          projectId,
          clipsCount: clips.length,
          estimatedTime: `${clips.length * 10}-${clips.length * 30} seconds`
        }
      })

    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to start batch processing',
        error: error.message
      })
    }
  }

  // Background download process
  private async downloadVideoAsync(projectId: number, youtubeUrl: string, quality: string, downloader: string = 'auto') {
    try {
      console.log(`📥 Starting download for project ${projectId} using ${downloader}`)
      
      let result
      
      // Choose download method based on downloader parameter
      switch (downloader) {
        case 'yt-dlp':
          result = await enhancedVideoProcessor.tryYtDlpDownload(youtubeUrl, projectId, quality)
          break
        case 'ytdl-core':
          result = await enhancedVideoProcessor.tryYtdlCoreDownload(youtubeUrl, projectId, quality)
          break
        case 'puppeteer':
          result = await enhancedVideoProcessor.tryPuppeteerDownload(youtubeUrl, projectId, quality)
          break
        case 'auto':
        default:
          result = await enhancedVideoProcessor.downloadVideo(youtubeUrl, projectId, quality)
          break
      }
      
      if (result.success) {
        // Update database with success using Lucid ORM
        const project = await VideoProject.find(projectId)
        if (project) {
          project.status = 'completed'
          project.videoFilePath = result.filePath
          await project.save()
        }
        
        console.log(`✅ Download completed for project ${projectId} using ${downloader}`)
      } else {
        // Update database with failure using Lucid ORM
        const project = await VideoProject.find(projectId)
        if (project) {
          project.status = 'failed'
          await project.save()
        }
        
        console.log(`❌ Download failed for project ${projectId} using ${downloader}: ${result.error}`)
      }

    } catch (error) {
      console.error(`❌ Download error for project ${projectId}:`, error)
      
      // Update database with failure using Lucid ORM
      const project = await VideoProject.find(projectId)
      if (project) {
        project.status = 'failed'
        await project.save()
      }
    }
  }

  // Background batch processing
  private async batchProcessAsync(projectId: number, clips: any[]) {
    try {
      console.log(`✂️ Starting batch processing for project ${projectId}`)
      
      const result = await enhancedVideoProcessor.batchProcessClips(projectId, clips)
      
      // Store clips in database
      for (const clip of result.clips) {
        if (clip.status === 'completed') {
          await databaseService.execute(`
            INSERT INTO clips (
              video_project_id, title, start_time, end_time, output_url, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'completed', datetime('now'), datetime('now'))
          `, [
            projectId,
            clip.title,
            0, // Will be updated with actual times
            0, // Will be updated with actual times  
            `/storage/clips/${clip.id}.mp4`
          ])
        }
      }

      // Update project status
      await databaseService.execute(`
        UPDATE video_projects 
        SET status = 'clips_ready', updated_at = datetime('now')
        WHERE id = ?
      `, [projectId])
      
      console.log(`✅ Batch processing completed for project ${projectId}`)

    } catch (error) {
      console.error(`❌ Batch processing error for project ${projectId}:`, error)
      
      await databaseService.execute(`
        UPDATE video_projects 
        SET status = 'failed', updated_at = datetime('now')
        WHERE id = ?
      `, [projectId])
    }
  }

  // List all projects
  async list({ response }: HttpContext) {
    try {
      response.header('Access-Control-Allow-Origin', '*')
      
      const projects = await databaseService.execute(`
        SELECT 
          id,
          title,
          youtube_url,
          status,
          duration,
          thumbnail_url,
          created_at,
          updated_at
        FROM video_projects 
        ORDER BY created_at DESC
      `)
      
      // Add additional info for each project
      const projectsWithInfo = await Promise.all(projects.rows.map(async (project: any) => {
        const videoId = this.extractVideoIdFromUrl(project.youtube_url)
        const hasVideo = videoId ? await videoReferenceService.findExistingVideo(project.youtube_url) : null
        
        return {
          id: project.id,
          title: project.title,
          youtubeUrl: project.youtube_url,
          status: project.status,
          duration: project.duration || 0,
          thumbnail: project.thumbnail_url,
          createdAt: project.created_at,
          updatedAt: project.updated_at,
          videoAvailable: !!hasVideo,
          source: hasVideo?.type || 'none'
        }
      }))
      
      return response.json({
        success: true,
        message: 'Projects retrieved successfully',
        data: projectsWithInfo
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to retrieve projects',
        error: error.message
      })
    }
  }

  // Resume failed/stuck download
  async resumeDownload({ params, response }: HttpContext) {
    try {
      const { projectId } = params
      
      response.header('Access-Control-Allow-Origin', '*')
      
      // Update database status to processing first
      const project = await VideoProject.find(projectId)
      if (project) {
        project.status = 'processing'
        await project.save()
      }
      
      const result = await enhancedVideoProcessor.resumeDownload(parseInt(projectId))
      
      if (result.success) {
        // Update database with success
        if (project) {
          project.status = 'completed'
          project.videoFilePath = result.filePath
          await project.save()
        }
        
        return response.json({
          success: true,
          message: 'Download resumed and completed successfully',
          data: { projectId, status: 'completed' }
        })
      } else {
        // Update database with failure
        if (project) {
          project.status = 'failed'
          await project.save()
        }
        
        return response.status(400).json({
          success: false,
          message: result.error || 'Failed to resume download'
        })
      }
    } catch (error) {
      // Update database with failure on exception
      try {
        const project = await VideoProject.find(params.projectId)
        if (project) {
          project.status = 'failed'
          await project.save()
        }
      } catch (dbError) {
        console.error('Failed to update database on error:', dbError)
      }
      
      return response.status(500).json({
        success: false,
        message: 'Failed to resume download',
        error: error.message
      })
    }
  }

  // Check and auto-resume stuck downloads
  async checkStuckDownloads({ response }: HttpContext) {
    try {
      response.header('Access-Control-Allow-Origin', '*')
      
      await enhancedVideoProcessor.checkAndResumeStuckDownloads()
      
      return response.json({
        success: true,
        message: 'Checked and resumed stuck downloads'
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to check stuck downloads',
        error: error.message
      })
    }
  }

  private extractVideoIdFromUrl(youtubeUrl: string): string | null {
    const match = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
    return match ? match[1] : null
  }

  // Validate and fix database consistency
  async validateDatabase({ response }: HttpContext) {
    try {
      response.header('Access-Control-Allow-Origin', '*')
      
      const result = await videoReferenceService.validateDatabaseConsistency()
      
      return response.json({
        success: true,
        message: `Database validation completed. Fixed ${result.fixed} issues.`,
        data: {
          fixed: result.fixed,
          errors: result.errors
        }
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Database validation failed',
        error: error.message
      })
    }
  }

  // Storage statistics endpoint
  async referenceStats({ response }: HttpContext) {
    try {
      response.header('Access-Control-Allow-Origin', '*')
      
      const stats = await videoReferenceService.getStorageStats()
      
      return response.json({
        success: true,
        message: 'Reference statistics retrieved',
        data: stats
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to get storage statistics',
        error: error.message
      })
    }
  }
}
