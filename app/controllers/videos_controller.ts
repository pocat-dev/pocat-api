import type { HttpContext } from '@adonisjs/core/http'
import ytdl from '@distube/ytdl-core'

export default class VideosController {
  // Disable streaming for now - YouTube blocks it
  async stream({ request, response }: HttpContext) {
    response.header('Access-Control-Allow-Origin', '*')
    return response.status(503).json({
      success: false,
      message: 'Video streaming temporarily disabled due to YouTube restrictions. Use clip rendering instead.',
      suggestion: 'Use POST /clips/render to create clips directly'
    })
  }

  async streamTest({ request, response }: HttpContext) {
    response.header('Access-Control-Allow-Origin', '*')
    return response.status(503).json({
      success: false,
      message: 'Video streaming temporarily disabled due to YouTube restrictions. Use clip rendering instead.',
      suggestion: 'Use POST /clips/render to create clips directly'
    })
  }

  async info({ request, response }: HttpContext) {
    const url = request.input('url')

    if (!url || !ytdl.validateURL(url)) {
      return response.badRequest({
        success: false,
        message: 'Invalid YouTube URL'
      })
    }

    try {
      const info = await ytdl.getInfo(url)
      
      // Set CORS headers
      response.header('Access-Control-Allow-Origin', '*')
      
      return response.json({
        success: true,
        data: {
          title: info.videoDetails.title,
          duration: info.videoDetails.lengthSeconds,
          thumbnail: info.videoDetails.thumbnails[0]?.url,
          description: info.videoDetails.description,
          author: info.videoDetails.author.name,
          viewCount: info.videoDetails.viewCount,
          // Add streaming status
          streamingAvailable: false,
          message: 'Video info available, but streaming disabled due to YouTube restrictions'
        }
      })

    } catch (error) {
      console.error('Video info error:', error)
      return response.internalServerError({
        success: false,
        message: 'Error getting video info',
        error: error.message
      })
    }
  }
}