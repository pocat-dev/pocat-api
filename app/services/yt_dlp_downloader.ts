import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'

const execAsync = promisify(exec)

export class YtDlpDownloader {
  private downloadDir: string
  private ytDlpPath: string

  constructor() {
    this.downloadDir = path.join(process.cwd(), 'storage', 'downloads')
    // Use poetry from root directory
    this.ytDlpPath = 'cd ../youtube-dl-test && poetry run yt-dlp'
  }

  async downloadVideo(url: string, filename?: string, quality: string = '720p'): Promise<string> {
    await fs.mkdir(this.downloadDir, { recursive: true })
    
    const outputTemplate = filename 
      ? `${filename}.%(ext)s`
      : '%(title)s.%(ext)s'
    
    const outputPath = path.join(this.downloadDir, outputTemplate)
    
    // Map quality to yt-dlp format selection
    const formatSelector = this.getFormatSelector(quality)
    const command = `${this.ytDlpPath} -f "${formatSelector}" --output "${outputPath}" "${url}"`
    
    try {
      const { stdout, stderr } = await execAsync(command)
      
      // Find the actual downloaded file
      const files = await fs.readdir(this.downloadDir)
      const downloadedFile = files.find(file => 
        file.includes(filename || 'video') || 
        file.endsWith('.mp4') || 
        file.endsWith('.webm')
      )
      
      if (!downloadedFile) {
        throw new Error('Downloaded file not found')
      }
      
      return path.join(this.downloadDir, downloadedFile)
    } catch (error) {
      throw new Error(`yt-dlp download failed: ${error.message}`)
    }
  }

  private getFormatSelector(quality: string): string {
    switch (quality.toLowerCase()) {
      case '144p':
        return 'worst[height<=144]'
      case '240p':
        return 'best[height<=240]'
      case '360p':
        return 'best[height<=360]'
      case '480p':
        return 'best[height<=480]'
      case '720p':
        return 'best[height<=720]'
      case '1080p':
        return 'best[height<=1080]'
      case '1440p':
        return 'best[height<=1440]'
      case '2160p':
      case '4k':
        return 'best[height<=2160]'
      case 'best':
        return 'best'
      case 'worst':
        return 'worst'
      default:
        return 'best[height<=720]' // Default to 720p
    }
  }

  async getVideoInfo(url: string): Promise<any> {
    const command = `${this.ytDlpPath} --dump-json "${url}"`
    
    try {
      const { stdout } = await execAsync(command)
      return JSON.parse(stdout)
    } catch (error) {
      throw new Error(`Failed to get video info: ${error.message}`)
    }
  }

  async getAvailableFormats(url: string): Promise<string> {
    const command = `${this.ytDlpPath} -F "${url}"`
    
    try {
      const { stdout } = await execAsync(command)
      return stdout
    } catch (error) {
      throw new Error(`Failed to get available formats: ${error.message}`)
    }
  }
}
