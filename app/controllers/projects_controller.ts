import type { HttpContext } from '@adonisjs/core/http'
import tursoService from '#services/turso_service'
import videoProcessor from '#services/video_processor'
import ytdl from '@distube/ytdl-core'

export default class ProjectsController {
  async index({ response }: HttpContext) {
    try {
      const result = await tursoService.execute(`
        SELECT vp.*, u.name as user_name,
               COUNT(c.id) as clips_count
        FROM video_projects vp
        LEFT JOIN users u ON vp.user_id = u.id
        LEFT JOIN clips c ON vp.id = c.video_project_id
        GROUP BY vp.id
        ORDER BY vp.created_at DESC
      `)
      
      return response.json({
        success: true,
        data: result.rows
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to fetch projects',
        error: error.message
      })
    }
  }

  async store({ request, response }: HttpContext) {
    try {
      const { title, youtubeUrl, userId } = request.only(['title', 'youtubeUrl', 'userId'])
      
      if (!title || !youtubeUrl || !userId) {
        return response.status(400).json({
          success: false,
          message: 'Title, YouTube URL, and User ID are required'
        })
      }

      if (!ytdl.validateURL(youtubeUrl)) {
        return response.status(400).json({
          success: false,
          message: 'Invalid YouTube URL'
        })
      }

      // Get video info
      const info = await ytdl.getInfo(youtubeUrl)
      const metadata = {
        title: info.videoDetails.title,
        author: info.videoDetails.author.name,
        duration: info.videoDetails.lengthSeconds,
        viewCount: info.videoDetails.viewCount,
        description: info.videoDetails.description
      }

      const result = await tursoService.execute(`
        INSERT INTO video_projects (
          user_id, title, youtube_url, video_metadata, 
          duration, thumbnail_url, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
      `, [
        userId,
        title,
        youtubeUrl,
        JSON.stringify(metadata),
        metadata.duration,
        info.videoDetails.thumbnails[0]?.url
      ])
      
      const projectId = Number(result.lastInsertRowid)

      // Start video processing in background
      this.processVideoAsync(projectId, youtubeUrl)
      
      return response.status(201).json({
        success: true,
        message: 'Project created successfully, video processing started',
        data: {
          id: projectId,
          title,
          youtubeUrl,
          metadata,
          status: 'processing'
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

  private async processVideoAsync(projectId: number, youtubeUrl: string) {
    try {
      // Update status to processing
      await tursoService.execute(`
        UPDATE video_projects SET status = 'processing', updated_at = datetime('now') WHERE id = ?
      `, [projectId])

      // Download video
      const videoPath = await videoProcessor.downloadYouTubeVideo(youtubeUrl, projectId)
      
      // Generate thumbnail
      const thumbnailPath = await videoProcessor.generateThumbnail(videoPath, projectId)
      const thumbnailUrl = videoProcessor.getPublicUrl(thumbnailPath, 'thumbnail')

      // Update project with file paths
      await tursoService.execute(`
        UPDATE video_projects 
        SET video_file_path = ?, thumbnail_url = ?, status = 'completed', updated_at = datetime('now')
        WHERE id = ?
      `, [videoPath, thumbnailUrl, projectId])

    } catch (error) {
      // Update status to failed
      await tursoService.execute(`
        UPDATE video_projects SET status = 'failed', updated_at = datetime('now') WHERE id = ?
      `, [projectId])
    }
  }

  async show({ params, response }: HttpContext) {
    try {
      const result = await tursoService.execute(`
        SELECT vp.*, u.name as user_name
        FROM video_projects vp
        LEFT JOIN users u ON vp.user_id = u.id
        WHERE vp.id = ?
      `, [params.id])
      
      if (result.rows.length === 0) {
        return response.status(404).json({
          success: false,
          message: 'Project not found'
        })
      }

      // Get clips for this project
      const clipsResult = await tursoService.execute(`
        SELECT * FROM clips WHERE video_project_id = ? ORDER BY start_time ASC
      `, [params.id])
      
      const project = result.rows[0] as any
      project.clips = clipsResult.rows
      
      return response.json({
        success: true,
        data: project
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to fetch project',
        error: error.message
      })
    }
  }

  async generateClips({ params, request, response }: HttpContext) {
    try {
      const { clipDuration = 30, maxClips = 5 } = request.only(['clipDuration', 'maxClips'])
      
      // Get project
      const projectResult = await tursoService.execute(`
        SELECT * FROM video_projects WHERE id = ?
      `, [params.id])
      
      if (projectResult.rows.length === 0) {
        return response.status(404).json({
          success: false,
          message: 'Project not found'
        })
      }

      const project = projectResult.rows[0] as any
      
      if (project.status !== 'completed') {
        return response.status(400).json({
          success: false,
          message: 'Video must be processed first'
        })
      }

      const duration = Number(project.duration) || 300
      
      // Generate clips at regular intervals
      const clips = []
      const interval = Math.floor(duration / maxClips)
      
      for (let i = 0; i < maxClips; i++) {
        const startTime = i * interval
        const endTime = Math.min(startTime + clipDuration, duration)
        
        if (startTime < duration) {
          const clipResult = await tursoService.execute(`
            INSERT INTO clips (
              video_project_id, title, start_time, end_time, 
              engagement_score, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
          `, [
            params.id,
            `Clip ${i + 1}`,
            startTime,
            endTime,
            Math.random() * 0.5 + 0.5
          ])
          
          clips.push({
            id: clipResult.lastInsertRowid,
            title: `Clip ${i + 1}`,
            startTime,
            endTime,
            duration: endTime - startTime,
            status: 'pending'
          })
        }
      }
      
      return response.json({
        success: true,
        message: `Generated ${clips.length} clips`,
        data: clips
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to generate clips',
        error: error.message
      })
    }
  }
}