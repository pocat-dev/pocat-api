import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

interface CacheEntry {
  videoId: string
  quality: string
  hasAudio: boolean
  filePath: string
  fileSize: number
  duration: number
  createdAt: Date
  lastAccessed: Date
  accessCount: number
}

class VideoCacheService {
  private cachePath: string
  private cacheIndex: Map<string, CacheEntry> = new Map()
  private maxCacheSize: number = 5 * 1024 * 1024 * 1024 // 5GB
  private maxCacheAge: number = 30 * 24 * 60 * 60 * 1000 // 30 days

  constructor() {
    this.cachePath = path.join(process.cwd(), 'storage', 'cache')
    this.ensureCacheDirectory()
    this.loadCacheIndex()
  }

  private ensureCacheDirectory() {
    if (!fs.existsSync(this.cachePath)) {
      fs.mkdirSync(this.cachePath, { recursive: true })
    }
  }

  private generateCacheKey(videoId: string, quality: string, hasAudio: boolean): string {
    return `${videoId}_${quality}_${hasAudio}`
  }

  private generateFileName(videoId: string, quality: string, hasAudio: boolean): string {
    return `${this.generateCacheKey(videoId, quality, hasAudio)}.mp4`
  }

  private extractVideoId(youtubeUrl: string): string {
    const match = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
    return match ? match[1] : crypto.createHash('md5').update(youtubeUrl).digest('hex')
  }

  // Check if video exists in cache
  isCached(youtubeUrl: string, quality: string, hasAudio: boolean = true): boolean {
    const videoId = this.extractVideoId(youtubeUrl)
    const cacheKey = this.generateCacheKey(videoId, quality, hasAudio)
    
    if (!this.cacheIndex.has(cacheKey)) {
      return false
    }

    const entry = this.cacheIndex.get(cacheKey)!
    const filePath = path.join(this.cachePath, this.generateFileName(videoId, quality, hasAudio))
    
    // Check if file still exists
    if (!fs.existsSync(filePath)) {
      this.cacheIndex.delete(cacheKey)
      return false
    }

    // Update access info
    entry.lastAccessed = new Date()
    entry.accessCount++
    
    return true
  }

  // Get cached video path
  getCachedPath(youtubeUrl: string, quality: string, hasAudio: boolean = true): string | null {
    if (!this.isCached(youtubeUrl, quality, hasAudio)) {
      return null
    }

    const videoId = this.extractVideoId(youtubeUrl)
    return path.join(this.cachePath, this.generateFileName(videoId, quality, hasAudio))
  }

  // Add video to cache
  addToCache(
    youtubeUrl: string, 
    quality: string, 
    hasAudio: boolean, 
    sourcePath: string, 
    duration: number
  ): string {
    const videoId = this.extractVideoId(youtubeUrl)
    const fileName = this.generateFileName(videoId, quality, hasAudio)
    const cachePath = path.join(this.cachePath, fileName)
    const cacheKey = this.generateCacheKey(videoId, quality, hasAudio)

    // Copy file to cache
    fs.copyFileSync(sourcePath, cachePath)
    
    const stats = fs.statSync(cachePath)
    const entry: CacheEntry = {
      videoId,
      quality,
      hasAudio,
      filePath: cachePath,
      fileSize: stats.size,
      duration,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 1
    }

    this.cacheIndex.set(cacheKey, entry)
    this.saveCacheIndex()
    this.cleanupOldCache()

    return cachePath
  }

  // Get cache statistics
  getCacheStats() {
    const entries = Array.from(this.cacheIndex.values())
    const totalSize = entries.reduce((sum, entry) => sum + entry.fileSize, 0)
    const totalFiles = entries.length

    return {
      totalFiles,
      totalSize: this.formatBytes(totalSize),
      maxSize: this.formatBytes(this.maxCacheSize),
      usage: ((totalSize / this.maxCacheSize) * 100).toFixed(1) + '%',
      entries: entries.map(entry => ({
        videoId: entry.videoId,
        quality: entry.quality,
        hasAudio: entry.hasAudio,
        size: this.formatBytes(entry.fileSize),
        duration: entry.duration,
        accessCount: entry.accessCount,
        lastAccessed: entry.lastAccessed
      }))
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  private loadCacheIndex() {
    const indexPath = path.join(this.cachePath, 'cache_index.json')
    if (fs.existsSync(indexPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
        this.cacheIndex = new Map(Object.entries(data).map(([key, value]: [string, any]) => [
          key,
          {
            ...value,
            createdAt: new Date(value.createdAt),
            lastAccessed: new Date(value.lastAccessed)
          }
        ]))
      } catch (error) {
        console.log('Failed to load cache index, starting fresh')
      }
    }
  }

  private saveCacheIndex() {
    const indexPath = path.join(this.cachePath, 'cache_index.json')
    const data = Object.fromEntries(this.cacheIndex)
    fs.writeFileSync(indexPath, JSON.stringify(data, null, 2))
  }

  private cleanupOldCache() {
    const entries = Array.from(this.cacheIndex.entries())
    const now = Date.now()

    // Remove old entries
    entries.forEach(([key, entry]) => {
      if (now - entry.lastAccessed.getTime() > this.maxCacheAge) {
        try {
          fs.unlinkSync(entry.filePath)
          this.cacheIndex.delete(key)
        } catch (error) {
          console.log(`Failed to delete cached file: ${entry.filePath}`)
        }
      }
    })

    // Remove least accessed if cache too large
    const totalSize = entries.reduce((sum, [, entry]) => sum + entry.fileSize, 0)
    if (totalSize > this.maxCacheSize) {
      const sortedEntries = entries.sort((a, b) => a[1].accessCount - b[1].accessCount)
      
      let currentSize = totalSize
      for (const [key, entry] of sortedEntries) {
        if (currentSize <= this.maxCacheSize * 0.8) break // Keep 80% of max size
        
        try {
          fs.unlinkSync(entry.filePath)
          this.cacheIndex.delete(key)
          currentSize -= entry.fileSize
        } catch (error) {
          console.log(`Failed to delete cached file: ${entry.filePath}`)
        }
      }
    }

    this.saveCacheIndex()
  }
}

// Named export for testing
export { VideoCacheService }

// Default export for application use
export default new VideoCacheService()
