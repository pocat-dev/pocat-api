import type { HttpContext } from '@adonisjs/core/http'
import tursoService from '#services/turso_service'
import enhancedVideoProcessor from '#services/enhanced_video_processor'

export default class EnhancedProjectsController {
  // Step 1: Create project and start video download
  async create({ request, response }: HttpContext) {
    try {
      const { title, youtubeUrl, userId, quality = '720p' } = request.only([
        'title', 'youtubeUrl', 'userId', 'quality'
      ])

      if (!title || !youtubeUrl || !userId) {
        return response.status(400).json({
          success: false,
          message: 'Title, YouTube URL, and User ID are required'
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

      // Create project in database
      const result = await tursoService.execute(`
        INSERT INTO video_projects (
          user_id, title, youtube_url, video_metadata, 
          duration, thumbnail_url, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'downloading', datetime('now'), datetime('now'))
      `, [
        userId,
        title,
        youtubeUrl,
        JSON.stringify(videoInfo.data),
        videoInfo.data.duration,
        videoInfo.data.thumbnail
      ])

      const projectId = Number(result.lastInsertRowid)

      // Start download in background
      this.downloadVideoAsync(projectId, youtubeUrl, quality)

      return response.status(201).json({
        success: true,
        message: 'Project created, video download started',
        data: {
          projectId,
          title,
          status: 'downloading',
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

      // Check database status
      const result = await tursoService.execute(`
        SELECT status, video_file_path FROM video_projects WHERE id = ?
      `, [projectId])

      if (result.rows.length === 0) {
        return response.status(404).json({
          success: false,
          message: 'Project not found'
        })
      }

      const project = result.rows[0] as any
      const isDownloaded = enhancedVideoProcessor.isVideoDownloaded(projectId)
      const progress = enhancedVideoProcessor.getDownloadProgress(projectId)

      return response.json({
        success: true,
        data: {
          projectId,
          status: project.status,
          downloaded: isDownloaded,
          progress: progress.progress,
          readyForEditing: isDownloaded && project.status === 'completed'
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

      // Update project status
      await tursoService.execute(`
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
  private async downloadVideoAsync(projectId: number, youtubeUrl: string, quality: string) {
    try {
      console.log(`📥 Starting download for project ${projectId}`)
      
      const result = await enhancedVideoProcessor.downloadVideo(youtubeUrl, projectId, quality)
      
      if (result.success) {
        // Update database with success
        await tursoService.execute(`
          UPDATE video_projects 
          SET status = 'completed', video_file_path = ?, updated_at = datetime('now')
          WHERE id = ?
        `, [result.filePath, projectId])
        
        console.log(`✅ Download completed for project ${projectId}`)
      } else {
        // Update database with failure
        await tursoService.execute(`
          UPDATE video_projects 
          SET status = 'failed', updated_at = datetime('now')
          WHERE id = ?
        `, [projectId])
        
        console.log(`❌ Download failed for project ${projectId}: ${result.error}`)
      }

    } catch (error) {
      console.error(`❌ Download error for project ${projectId}:`, error)
      
      await tursoService.execute(`
        UPDATE video_projects 
        SET status = 'failed', updated_at = datetime('now')
        WHERE id = ?
      `, [projectId])
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
          await tursoService.execute(`
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
      await tursoService.execute(`
        UPDATE video_projects 
        SET status = 'clips_ready', updated_at = datetime('now')
        WHERE id = ?
      `, [projectId])
      
      console.log(`✅ Batch processing completed for project ${projectId}`)

    } catch (error) {
      console.error(`❌ Batch processing error for project ${projectId}:`, error)
      
      await tursoService.execute(`
        UPDATE video_projects 
        SET status = 'failed', updated_at = datetime('now')
        WHERE id = ?
      `, [projectId])
    }
  }
}
