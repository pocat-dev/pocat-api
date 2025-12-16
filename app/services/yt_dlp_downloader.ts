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

  async downloadVideo(url: string, filename?: string): Promise<string> {
    await fs.mkdir(this.downloadDir, { recursive: true })
    
    const outputTemplate = filename 
      ? `${filename}.%(ext)s`
      : '%(title)s.%(ext)s'
    
    const outputPath = path.join(this.downloadDir, outputTemplate)
    
    const command = `${this.ytDlpPath} -f "best[height<=720]" --output "${outputPath}" "${url}"`
    
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

  async getVideoInfo(url: string): Promise<any> {
    const command = `${this.ytDlpPath} --dump-json "${url}"`
    
    try {
      const { stdout } = await execAsync(command)
      return JSON.parse(stdout)
    } catch (error) {
      throw new Error(`Failed to get video info: ${error.message}`)
    }
  }
}
