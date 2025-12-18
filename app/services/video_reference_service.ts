import fs from 'fs'
import path from 'path'

interface VideoReference {
  projectId: number
  referenceTo: string
  originalProject: number
  videoId: string
  quality: string
  hasAudio: boolean
  createdAt: Date
  metadata: {
    title?: string
    duration?: number
    fileSize?: number
  }
}

class VideoReferenceService {
  private downloadsPath: string
  private referencesPath: string

  constructor() {
    this.downloadsPath = path.join(process.cwd(), 'storage', 'downloads')
    this.referencesPath = path.join(process.cwd(), 'storage', 'references')
    this.ensureDirectories()
  }

  // Validate and fix database consistency
  async validateDatabaseConsistency(): Promise<{ fixed: number, errors: string[] }> {
    const errors: string[] = []
    let fixed = 0
    
    try {
      const { default: db } = await import('@adonisjs/lucid/services/db')
      
      // 1. Fix projects with references but no video_file_path
      const referenceFiles = fs.readdirSync(this.referencesPath).filter(f => f.endsWith('.json'))
      
      for (const refFile of referenceFiles) {
        try {
          const refData = JSON.parse(fs.readFileSync(path.join(this.referencesPath, refFile), 'utf8'))
          const projectId = refData.projectId
          const videoFile = refData.referenceTo
          const videoPath = path.join(process.cwd(), 'storage', 'downloads', videoFile)
          
          const project = await db.from('video_projects').where('id', projectId).first()
          if (project && !project.video_file_path) {
            await db.from('video_projects')
              .where('id', projectId)
              .update({
                video_file_path: videoPath,
                status: 'completed',
                updated_at: new Date()
              })
            fixed++
            console.log(`✅ Fixed reference project ${projectId}`)
          }
        } catch (error) {
          errors.push(`Failed to process reference ${refFile}: ${error.message}`)
        }
      }
      
      // 2. Fix projects with existing videos but wrong status
      const videoFiles = fs.readdirSync(this.downloadsPath).filter(f => f.endsWith('.mp4'))
      
      for (const videoFile of videoFiles) {
        const videoId = videoFile.split('_')[0]
        const videoPath = path.join(process.cwd(), 'storage', 'downloads', videoFile)
        
        const projects = await db.from('video_projects')
          .whereRaw('youtube_url LIKE ?', [`%${videoId}%`])
          .where('status', '!=', 'completed')
        
        for (const project of projects) {
          await db.from('video_projects')
            .where('id', project.id)
            .update({
              status: 'completed',
              video_file_path: videoPath,
              updated_at: new Date()
            })
          fixed++
          console.log(`✅ Fixed video project ${project.id}`)
        }
      }
      
    } catch (error) {
      errors.push(`Database validation failed: ${error.message}`)
    }
    
    return { fixed, errors }
  }

  private ensureDirectories() {
    if (!fs.existsSync(this.downloadsPath)) {
      fs.mkdirSync(this.downloadsPath, { recursive: true })
    }
    if (!fs.existsSync(this.referencesPath)) {
      fs.mkdirSync(this.referencesPath, { recursive: true })
    }
  }

  private extractVideoId(youtubeUrl: string): string {
    const match = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
    return match ? match[1] : ''
  }

  // Check if video already exists in downloads
  findExistingVideo(youtubeUrl: string, quality: string = '720p', hasAudio: boolean = true): { type: 'master' | 'downloading' | 'reference', path: string } | null {
    const videoId = this.extractVideoId(youtubeUrl)
    const expectedFilename = `${videoId}_${quality}_${hasAudio}.mp4`
    const partFilename = `${expectedFilename}.part`
    
    try {
      const downloadFiles = fs.readdirSync(this.downloadsPath)
      
      // Check for completed file first
      if (downloadFiles.includes(expectedFilename)) {
        console.log(`🎯 Found completed video: ${expectedFilename}`)
        return { type: 'master', path: expectedFilename }
      }
      
      // Check for downloading file (.part)
      if (downloadFiles.some(file => file.startsWith(`${videoId}_${quality}_${hasAudio}.mp4.part`))) {
        console.log(`⏳ Found downloading video: ${videoId}`)
        return { type: 'downloading', path: partFilename }
      }
      
      console.log(`💾 No existing video found for ${videoId}`)
      return null
    } catch (error) {
      return null
    }
  }

  private extractProjectIdFromFilename(filename: string): number | null {
    const match = filename.match(/project_(\d+)_full\.mp4/)
    return match ? parseInt(match[1]) : null
  }

  // Create reference to existing video
  async createReference(
    projectId: number,
    youtubeUrl: string,
    quality: string,
    hasAudio: boolean,
    existingFile: string,
    metadata: any = {}
  ): Promise<string> {
    const videoId = this.extractVideoId(youtubeUrl)
    const originalProjectId = this.extractProjectIdFromFilename(existingFile)
    
    const reference: VideoReference = {
      projectId,
      referenceTo: existingFile,
      originalProject: originalProjectId || 0,
      videoId,
      quality,
      hasAudio,
      createdAt: new Date(),
      metadata: {
        title: metadata.title,
        duration: metadata.duration,
        fileSize: metadata.fileSize
      }
    }

    const referenceFile = `project_${projectId}_ref.json`
    const referencePath = path.join(this.referencesPath, referenceFile)
    
    fs.writeFileSync(referencePath, JSON.stringify(reference, null, 2))
    
    // 🔧 FIX: Update database with reference path
    try {
      const { default: db } = await import('@adonisjs/lucid/services/db')
      const fullVideoPath = path.join(process.cwd(), 'storage', 'downloads', existingFile)
      
      await db.from('video_projects')
        .where('id', projectId)
        .update({
          status: 'completed',
          video_file_path: fullVideoPath,
          updated_at: new Date()
        })
        
      console.log(`✅ Updated database for reference project ${projectId}`)
    } catch (error) {
      console.error(`❌ Failed to update database for project ${projectId}:`, error)
    }
    
    return referencePath
  }

  // Get actual video file path for project
  async getVideoFilePath(projectId: number): Promise<string | null> {
    // First check if it's a reference
    const referencePath = path.join(this.referencesPath, `project_${projectId}_ref.json`)
    if (fs.existsSync(referencePath)) {
      try {
        const referenceData = JSON.parse(fs.readFileSync(referencePath, 'utf8')) as VideoReference
        const actualPath = path.join(this.downloadsPath, referenceData.referenceTo)
        
        if (fs.existsSync(actualPath)) {
          return actualPath
        }
      } catch (error) {
        console.error(`Failed to read reference for project ${projectId}:`, error)
      }
    }

    // Check legacy direct download pattern
    const directPath = path.join(this.downloadsPath, `project_${projectId}_full.mp4`)
    if (fs.existsSync(directPath)) {
      return directPath
    }

    // NEW: Use database to find video file for this project
    try {
      const db = (await import('@adonisjs/lucid/services/db')).default
      const project = await db.from('video_projects').where('id', projectId).first()
      
      if (project && project.youtube_url) {
        // Extract video ID from YouTube URL
        const match = project.youtube_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
        if (match) {
          const videoId = match[1]
          const expectedFile = `${videoId}_720p_true.mp4`
          const filePath = path.join(this.downloadsPath, expectedFile)
          
          if (fs.existsSync(filePath)) {
            return filePath
          }
        }
      }
    } catch (error) {
      console.error(`Database lookup failed for project ${projectId}:`, error)
    }

    // Fallback: Check if this project created a master file (new naming pattern)
    try {
      const downloadFiles = fs.readdirSync(this.downloadsPath)
      
      // Look for video files with new naming pattern
      for (const file of downloadFiles) {
        if (file.endsWith('.mp4') && file.includes('_720p_true')) {
          const filePath = path.join(this.downloadsPath, file)
          if (fs.existsSync(filePath)) {
            return filePath
          }
        }
      }
    } catch (error) {
      console.error(`Failed to scan downloads directory:`, error)
    }

    return null
  }

  // Check if project has video (direct or reference)
  async hasVideo(projectId: number): Promise<boolean> {
    const videoPath = await this.getVideoFilePath(projectId)
    return videoPath !== null
  }

  // Get reference statistics
  getReferenceStats() {
    try {
      const downloadFiles = fs.readdirSync(this.downloadsPath).filter(f => f.endsWith('.mp4'))
      const referenceFiles = fs.readdirSync(this.referencesPath).filter(f => f.endsWith('.json'))
      
      let totalSize = 0
      const masterFiles: any[] = []
      
      // Calculate master files size
      downloadFiles.forEach(file => {
        const filePath = path.join(this.downloadsPath, file)
        const stats = fs.statSync(filePath)
        totalSize += stats.size
        
        masterFiles.push({
          filename: file,
          size: this.formatBytes(stats.size),
          projectId: this.extractProjectIdFromFilename(file)
        })
      })

      // Count references per master file
      const references: any[] = []
      referenceFiles.forEach(file => {
        try {
          const refPath = path.join(this.referencesPath, file)
          const refData = JSON.parse(fs.readFileSync(refPath, 'utf8')) as VideoReference
          references.push({
            projectId: refData.projectId,
            referenceTo: refData.referenceTo,
            originalProject: refData.originalProject,
            videoId: refData.videoId,
            createdAt: refData.createdAt
          })
        } catch (error) {
          // Skip invalid reference files
        }
      })

      return {
        masterFiles: masterFiles.length,
        referenceFiles: referenceFiles.length,
        totalProjects: masterFiles.length + referenceFiles.length,
        totalSize: this.formatBytes(totalSize),
        storageEfficiency: referenceFiles.length > 0 ? 
          `${((referenceFiles.length / (masterFiles.length + referenceFiles.length)) * 100).toFixed(1)}% space saved` : 
          'No references yet',
        masters: masterFiles,
        references: references
      }
    } catch (error) {
      return {
        error: 'Failed to calculate reference statistics',
        masterFiles: 0,
        referenceFiles: 0,
        totalProjects: 0
      }
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Get storage statistics
  async getStorageStats() {
    try {
      const downloadFiles = fs.readdirSync(this.downloadsPath)
      const referenceFiles = fs.readdirSync(this.referencesPath)
      
      const masters = []
      const references = []
      let totalSize = 0
      
      // Process master files
      for (const file of downloadFiles) {
        if (file.endsWith('.mp4')) {
          const filePath = path.join(this.downloadsPath, file)
          const stats = fs.statSync(filePath)
          const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2)
          
          // Extract video ID from filename to find associated project
          const videoIdMatch = file.match(/^([^_]+)_/)
          let projectId = null
          
          if (videoIdMatch) {
            const videoId = videoIdMatch[1]
            // Find project that created this master file
            try {
              const db = (await import('@adonisjs/lucid/services/db')).default
              const project = await db.from('video_projects')
                .whereRaw("youtube_url LIKE ?", [`%${videoId}%`])
                .orderBy('created_at', 'asc')
                .first()
              
              if (project) {
                projectId = project.id
              }
            } catch (error) {
              // Ignore database errors
            }
          }
          
          masters.push({
            filename: file,
            size: `${sizeInMB} MB`,
            projectId: projectId
          })
          
          totalSize += stats.size
        }
      }
      
      // Process reference files
      for (const file of referenceFiles) {
        if (file.endsWith('.json')) {
          try {
            const refData = JSON.parse(fs.readFileSync(path.join(this.referencesPath, file), 'utf8'))
            references.push({
              filename: file,
              referenceTo: refData.referenceTo,
              projectId: refData.projectId
            })
          } catch (error) {
            // Skip invalid reference files
          }
        }
      }
      
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2)
      const efficiency = references.length > 0 
        ? `${Math.round((references.length / (masters.length + references.length)) * 100)}% space saved`
        : 'No references yet'
      
      return {
        masterFiles: masters.length,
        referenceFiles: references.length,
        totalProjects: masters.length + references.length,
        totalSize: `${totalSizeMB} MB`,
        storageEfficiency: efficiency,
        masters,
        references
      }
    } catch (error) {
      return {
        masterFiles: 0,
        referenceFiles: 0,
        totalProjects: 0,
        totalSize: '0 MB',
        storageEfficiency: 'Error calculating stats',
        masters: [],
        references: []
      }
    }
  }
}

export { VideoReferenceService }
export default new VideoReferenceService()
