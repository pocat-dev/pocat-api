import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import ytdl from '@distube/ytdl-core'

class VideoProcessor {
  private storagePath = path.join(process.cwd(), 'storage')

  async downloadYouTubeVideo(url: string, projectId: number): Promise<string> {
    const videoPath = path.join(this.storagePath, 'videos', `project_${projectId}.mp4`)
    
    return new Promise((resolve, reject) => {
      const stream = ytdl(url, { quality: '18' })
      const writeStream = require('fs').createWriteStream(videoPath)
      
      stream.pipe(writeStream)
      
      writeStream.on('finish', () => resolve(videoPath))
      writeStream.on('error', reject)
      stream.on('error', reject)
    })
  }

  async generateThumbnail(videoPath: string, projectId: number): Promise<string> {
    const thumbnailPath = path.join(this.storagePath, 'thumbnails', `project_${projectId}.jpg`)
    
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['10%'],
          filename: `project_${projectId}.jpg`,
          folder: path.join(this.storagePath, 'thumbnails'),
          size: '640x360'
        })
        .on('end', () => resolve(thumbnailPath))
        .on('error', reject)
    })
  }

  async createClip(videoPath: string, startTime: number, endTime: number, clipId: number): Promise<string> {
    const clipPath = path.join(this.storagePath, 'clips', `clip_${clipId}.mp4`)
    
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .setStartTime(startTime)
        .setDuration(endTime - startTime)
        .output(clipPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .on('end', () => resolve(clipPath))
        .on('error', reject)
        .run()
    })
  }

  async getVideoInfo(videoPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err: any, metadata: any) => {
        if (err) reject(err)
        else resolve(metadata)
      })
    })
  }

  getPublicUrl(filePath: string, type: 'video' | 'clip' | 'thumbnail'): string {
    const filename = path.basename(filePath)
    return `/storage/${type}s/${filename}`
  }
}

export default new VideoProcessor()
