import type { HttpContext } from '@adonisjs/core/http'
import tursoService from '#services/turso_service'
import videoProcessor from '#services/video_processor'
import ytdl from '@distube/ytdl-core'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'

export default class ClipsController {
  async index({ response }: HttpContext) {
    try {
      const result = await tursoService.execute(`
        SELECT c.*, vp.title as project_title 
        FROM clips c
        LEFT JOIN video_projects vp ON c.video_project_id = vp.id
        ORDER BY c.created_at DESC
      `)
      
      return response.json({
        success: true,
        data: result.rows
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to fetch clips',
        error: error.message
      })
    }
  }

  async show({ params, response }: HttpContext) {
    try {
      const result = await tursoService.execute(`
        SELECT c.*, vp.title as project_title, vp.video_file_path
        FROM clips c
        LEFT JOIN video_projects vp ON c.video_project_id = vp.id
        WHERE c.id = ?
      `, [params.id])
      
      if (result.rows.length === 0) {
        return response.status(404).json({
          success: false,
          message: 'Clip not found'
        })
      }
      
      return response.json({
        success: true,
        data: result.rows[0]
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to fetch clip',
        error: error.message
      })
    }
  }

  // Test endpoint untuk demo MVP
  async renderTest({ request, response }: HttpContext) {
    try {
      const { startTime, endTime, aspectRatio = '9:16' } = request.only([
        'startTime', 'endTime', 'aspectRatio'
      ])

      // Set CORS headers
      response.header('Access-Control-Allow-Origin', '*')

      // Generate test clip ID
      const timestamp = Date.now()
      const clipId = `test_clip_${timestamp}`
      
      // Create a simple test video file (placeholder)
      const outputPath = path.join(process.cwd(), 'storage', 'clips', `${clipId}.mp4`)
      
      // For MVP demo, create a simple response
      setTimeout(async () => {
        try {
          // Create a simple test file
          fs.writeFileSync(outputPath, 'test video content')
          console.log(`✅ Test clip ${clipId} created successfully`)
        } catch (error) {
          console.error(`❌ Failed to create test clip ${clipId}:`, error)
        }
      }, 5000) // 5 second delay to simulate processing

      return response.json({
        success: true,
        message: 'Test clip rendering started',
        data: {
          clipId,
          downloadUrl: `https://nonimitating-corie-extemporary.ngrok-free.dev/storage/clips/${clipId}.mp4`,
          status: 'processing',
          estimatedTime: '5 seconds (test mode)'
        }
      })

    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to start test clip rendering',
        error: error.message
      })
    }
  }
  async render({ request, response }: HttpContext) {
    try {
      const { videoUrl, startTime, endTime, aspectRatio = '16:9' } = request.only([
        'videoUrl', 'startTime', 'endTime', 'aspectRatio'
      ])

      if (!videoUrl || startTime === undefined || endTime === undefined) {
        return response.status(400).json({
          success: false,
          message: 'videoUrl, startTime, and endTime are required'
        })
      }

      // Set CORS headers
      response.header('Access-Control-Allow-Origin', '*')

      // Generate unique filename
      const timestamp = Date.now()
      const clipId = `clip_${timestamp}`

      // Create demo clip immediately due to YouTube restrictions
      setTimeout(() => {
        this.createDemoClip(clipId, startTime, endTime, aspectRatio)
      }, 2000)

      return response.json({
        success: true,
        message: 'Demo clip rendering started (YouTube access restricted)',
        data: {
          clipId,
          downloadUrl: `https://nonimitating-corie-extemporary.ngrok-free.dev/storage/clips/${clipId}.mp4`,
          status: 'processing',
          estimatedTime: '5-10 seconds (demo mode)',
          note: 'Creating demo clip due to YouTube access restrictions'
        }
      })

    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to start clip rendering',
        error: error.message
      })
    }
  }

  // Create demo clip
  private async createDemoClip(clipId: string, startTime: number, endTime: number, aspectRatio: string) {
    try {
      const outputPath = path.join(process.cwd(), 'storage', 'clips', `${clipId}.mp4`)
      const duration = endTime - startTime
      const [width, height] = aspectRatio.split(':').map(Number)
      
      // Calculate dimensions
      let videoWidth = width * 80
      let videoHeight = height * 80
      
      if (videoWidth > 720) {
        const scale = 720 / videoWidth
        videoWidth = 720
        videoHeight = Math.round(videoHeight * scale)
      }

      ffmpeg.setFfmpegPath('/usr/bin/ffmpeg')

      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(`color=c=0x4A90E2:size=${videoWidth}x${videoHeight}:duration=${duration}:rate=30`)
          .inputFormat('lavfi')
          .input(`sine=frequency=440:duration=${duration}`)
          .inputFormat('lavfi')
          .videoCodec('libx264')
          .audioCodec('aac')
          .format('mp4')
          .output(outputPath)
          .on('end', () => {
            console.log(`✅ Demo clip ${clipId} created successfully`)
            resolve()
          })
          .on('error', (err) => {
            console.error(`❌ Error creating demo clip ${clipId}:`, err)
            // Fallback: create text file
            fs.writeFileSync(outputPath.replace('.mp4', '.txt'), 
              `Demo Clip\nClip ID: ${clipId}\nDuration: ${duration}s\nAspect Ratio: ${aspectRatio}\nNote: Demo mode due to YouTube restrictions`)
            resolve()
          })
          .run()
      })

    } catch (error) {
      console.error(`❌ Failed to create demo clip ${clipId}:`, error)
    }
  }

  // Background processing untuk render clip
  private async processClipAsync(
    videoUrl: string, 
    startTime: number, 
    endTime: number, 
    aspectRatio: string,
    clipId: string,
    outputPath: string
  ) {
    try {
      // Set FFmpeg path
      ffmpeg.setFfmpegPath('/usr/bin/ffmpeg')
      
      // Download video stream dan process langsung dengan FFmpeg
      const videoStream = ytdl(videoUrl, { quality: '18' })
      
      // Parse aspect ratio
      const [width, height] = aspectRatio.split(':').map(Number)
      const cropFilter = this.getCropFilter(width, height)

      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoStream)
          .setStartTime(startTime)
          .setDuration(endTime - startTime)
          .videoFilters(cropFilter)
          .videoCodec('libx264')
          .audioCodec('aac')
          .format('mp4')
          .output(outputPath)
          .on('end', () => {
            console.log(`✅ Clip ${clipId} rendered successfully`)
            resolve()
          })
          .on('error', (err) => {
            console.error(`❌ Error rendering clip ${clipId}:`, err)
            reject(err)
          })
          .run()
      })

    } catch (error) {
      console.error(`❌ Failed to process clip ${clipId}:`, error)
    }
  }

  // Helper untuk generate crop filter berdasarkan aspect ratio
  private getCropFilter(targetWidth: number, targetHeight: number): string {
    // Default: center crop untuk aspect ratio yang diminta
    if (targetWidth === 9 && targetHeight === 16) {
      // Portrait mode (9:16) - crop dari center
      return 'crop=ih*9/16:ih:(iw-ih*9/16)/2:0'
    } else if (targetWidth === 16 && targetHeight === 9) {
      // Landscape mode (16:9) - biasanya tidak perlu crop
      return 'scale=1280:720'
    } else if (targetWidth === 1 && targetHeight === 1) {
      // Square (1:1) - crop ke square
      return 'crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2'
    }
    
    // Default: scale to fit
    return `scale=${targetWidth * 80}:${targetHeight * 80}`
  }

  // Check status clip
  async status({ params, response }: HttpContext) {
    try {
      const { clipId } = params
      const clipPath = path.join(process.cwd(), 'storage', 'clips', `${clipId}.mp4`)

      // Set CORS headers
      response.header('Access-Control-Allow-Origin', '*')

      if (fs.existsSync(clipPath)) {
        const stats = fs.statSync(clipPath)
        return response.json({
          success: true,
          status: 'completed',
          downloadUrl: `https://nonimitating-corie-extemporary.ngrok-free.dev/storage/clips/${clipId}.mp4`,
          fileSize: stats.size,
          createdAt: stats.birthtime
        })
      } else {
        return response.json({
          success: true,
          status: 'processing',
          message: 'Clip is still being processed'
        })
      }

    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to check clip status',
        error: error.message
      })
    }
  }

  async process({ params, response }: HttpContext) {
    try {
      // Get clip info
      const clipResult = await tursoService.execute(`
        SELECT c.*, vp.video_file_path
        FROM clips c
        LEFT JOIN video_projects vp ON c.video_project_id = vp.id
        WHERE c.id = ?
      `, [params.id])
      
      if (clipResult.rows.length === 0) {
        return response.status(404).json({
          success: false,
          message: 'Clip not found'
        })
      }

      const clip = clipResult.rows[0] as any
      
      if (!clip.video_file_path) {
        return response.status(400).json({
          success: false,
          message: 'Source video not available'
        })
      }

      // Update status to processing
      await tursoService.execute(`
        UPDATE clips SET status = 'processing', updated_at = datetime('now') WHERE id = ?
      `, [params.id])

      // Process clip in background
      this.processClipFromFile(clip)
      
      return response.json({
        success: true,
        message: 'Clip processing started',
        data: { id: params.id, status: 'processing' }
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to start clip processing',
        error: error.message
      })
    }
  }

  private async processClipFromFile(clip: any) {
    try {
      // Create clip file
      const clipPath = await videoProcessor.createClip(
        clip.video_file_path,
        clip.start_time,
        clip.end_time,
        clip.id
      )

      // Get public URL
      const outputUrl = videoProcessor.getPublicUrl(clipPath, 'clip')

      // Update clip with output URL
      await tursoService.execute(`
        UPDATE clips 
        SET output_url = ?, status = 'completed', updated_at = datetime('now')
        WHERE id = ?
      `, [outputUrl, clip.id])

    } catch (error) {
      // Update status to failed
      await tursoService.execute(`
        UPDATE clips 
        SET status = 'failed', updated_at = datetime('now')
        WHERE id = ?
      `, [clip.id])
    }
  }

  async stream({ params, response }: HttpContext) {
    try {
      const result = await tursoService.execute(`
        SELECT output_url FROM clips WHERE id = ?
      `, [params.id])
      
      if (result.rows.length === 0) {
        return response.status(404).json({
          success: false,
          message: 'Clip not found'
        })
      }

      const clip = result.rows[0] as any
      
      if (!clip.output_url) {
        return response.status(404).json({
          success: false,
          message: 'Clip not processed yet'
        })
      }

      // Stream the clip file
      const clipPath = clip.output_url.replace('/storage/clips/', 'storage/clips/')
      const fs = require('fs')
      
      if (!fs.existsSync(clipPath)) {
        return response.status(404).json({
          success: false,
          message: 'Clip file not found'
        })
      }

      response.header('Content-Type', 'video/mp4')
      return response.stream(fs.createReadStream(clipPath))
      
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to stream clip',
        error: error.message
      })
    }
  }
}