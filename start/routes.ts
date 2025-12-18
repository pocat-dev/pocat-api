/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import path from 'path'
import fs from 'fs'

const TestsController = () => import('#controllers/tests_controller')
const UsersController = () => import('#controllers/users_controller')
const VideosController = () => import('#controllers/videos_controller')
const ProjectsController = () => import('#controllers/projects_controller')
const ClipsController = () => import('#controllers/clips_controller')

// CORS OPTIONS handler
router.route('*', ['OPTIONS'], async ({ response }: any) => {
  response.header('Access-Control-Allow-Origin', '*')
  response.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response.status(200).send('')
})

router.get('/', async () => {
  return {
    name: 'Pocat.io API',
    version: '2.1.0',
    description: 'AI Video Clipper API - Transform long videos into engaging clips with smart caching',
    message: 'Welcome to Pocat.io - Your Enhanced AI Video Clipper Backend',
    ngrok_url: 'https://nonimitating-corie-extemporary.ngrok-free.dev/',
    
    // Enhanced Features
    features: {
      smart_caching: 'Prevents duplicate downloads with reference-based storage',
      real_time_progress: 'Live download progress tracking with source detection',
      shared_downloads: 'Multiple projects can share same video download',
      space_optimization: 'Up to 50% storage savings through deduplication',
      multiple_downloaders: 'yt-dlp, ytdl-core, puppeteer fallbacks'
    },
    
    workflows: {
      v1_demo_mode: {
        description: 'Direct clip rendering with demo mode fallback',
        endpoints: {
          'POST /clips/render': 'Create demo clip immediately',
          'GET /clips/status/:clipId': 'Check clip status'
        }
      },
      v2_enhanced_mode: {
        description: 'Download-first workflow with smart caching and progress tracking',
        flow: [
          '1. POST /v2/projects - Create project & start download',
          '2. GET /v2/projects/:id/download-status - Monitor real-time progress', 
          '3. GET /v2/projects/:id/stream - Stream for frontend editing',
          '4. POST /v2/projects/:id/batch-clips - Process AI timestamps'
        ]
      }
    },
    
    endpoints: {
      // Core API
      'GET /video/info?url=YOUTUBE_URL': '📊 Get YouTube video info',
      
      // V1 - Demo Mode (Current)
      'POST /clips/render': '✂️ Render demo clip (YouTube blocked)',
      'GET /clips/status/:clipId': '📊 Check demo clip status',
      
      // V2 - Enhanced Mode (NEW)
      'POST /v2/projects': '📥 Create project & start smart download',
      'GET /v2/projects/:id/download-status': '📊 Real-time progress with source detection',
      'GET /v2/projects/:id/stream': '🎬 Stream video for editing',
      'POST /v2/projects/:id/batch-clips': '✂️ Batch process AI clips',
      'GET /v2/storage/stats': '📈 Storage analytics & space savings',
      
      // Static Files
      'GET /storage/clips/*': '🎬 Access processed clips',
      'GET /storage/downloads/*': '📁 Access downloaded videos',
      
      // Health Check
      'GET /health': '💚 API health status & uptime'
    },
    
    // Enhanced API Response Examples (Frontend Compatible)
    download_status_responses: {
      fresh_download: {
        description: 'Original download in progress',
        example: {
          readyForEditing: false,
          status: 'downloading',
          progress: 45,
          video: { source: 'fresh' }
        }
      },
      shared_download: {
        description: 'Multiple projects sharing same video download',
        example: {
          readyForEditing: false,
          status: 'downloading', 
          progress: 45,
          video: { source: 'shared' }
        }
      },
      cached_video: {
        description: 'Video already downloaded and cached',
        example: {
          readyForEditing: true,
          status: 'completed',
          progress: 100,
          video: { source: 'cached' }
        }
      }
    },
    
    example_v2_workflow: {
      step1: {
        method: 'POST',
        url: '/v2/projects',
        body: {
          title: 'My Video Project',
          youtubeUrl: 'https://youtube.com/watch?v=...',
          userId: 1
        },
        response: {
          projectId: 1,
          status: 'downloading',
          videoInfo: { title: '...', duration: 214 }
        }
      },
      step2: {
        method: 'GET',
        url: '/v2/projects/1/download-status',
        response: {
          readyForEditing: false,
          status: 'downloading',
          progress: 75,
          video: { source: 'fresh' }
        }
      },
      step3: {
        method: 'GET', 
        url: '/v2/projects/1/download-status',
        response: {
          readyForEditing: true,
          status: 'completed',
          progress: 100,
          video: { source: 'cached' }
        }
      },
      step4: {
        method: 'GET',
        url: '/v2/projects/1/stream',
        headers: { Range: 'bytes=0-1023' }
      }
    },
    
    storage_optimization: {
      description: 'Smart reference-based storage system with database abstraction',
      benefits: [
        'Prevents duplicate video downloads',
        'Shares downloads across multiple projects', 
        'Up to 50% storage space savings (tested with 6 projects)',
        'Instant access to previously downloaded videos',
        'Automatic dev/prod database switching (SQLite ↔ Turso)'
      ],
      source_types: {
        fresh: 'Original download for new video',
        shared: 'Multiple projects sharing same download',
        cached: 'Video already available (instant access)'
      },
      performance: {
        fresh_download: '15-20 seconds (depending on video size)',
        cache_hit: 'Instant (< 1 second)',
        storage_efficiency: '50% space saved with reference system',
        concurrent_projects: 'Unlimited projects per video'
      },
      database_service: {
        development: 'SQLite + Lucid ORM (automatic)',
        production: 'Turso + LibSQL (automatic)',
        abstraction: 'Environment-based switching with unified API'
      }
    }
  }
})

// Health check endpoint
router.get('/health', async () => {
  const uptime = process.uptime()
  const hours = Math.floor(uptime / 3600)
  const minutes = Math.floor((uptime % 3600) / 60)
  
  return {
    success: true,
    message: 'Pocat.io API is online',
    data: {
      version: '2.1.0',
      uptime: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
    }
  }
})

// Test routes
router.get('/test-turso', [TestsController, 'index'])
router.post('/create-table', [TestsController, 'createTable'])

// Users API
router.resource('users', UsersController).apiOnly()

// Video streaming (FRONTEND READY)
router.get('/stream', [VideosController, 'stream'])
router.get('/stream-test', [VideosController, 'streamTest'])  // NEW: Simple test
router.get('/video/info', [VideosController, 'info'])

// Enhanced Projects API (NEW WORKFLOW)
const EnhancedProjectsController = () => import('#controllers/enhanced_projects_controller')

// Enhanced workflow routes
router.get('/v2/projects', [EnhancedProjectsController, 'list'])  // List all projects
router.post('/v2/projects', [EnhancedProjectsController, 'create'])  // Step 1: Create + Download
router.get('/v2/projects/:projectId/download-status', [EnhancedProjectsController, 'downloadStatus'])  // Step 2: Check status
router.post('/v2/projects/:projectId/resume', [EnhancedProjectsController, 'resumeDownload'])  // Resume failed download
router.get('/v2/projects/:projectId/stream', [EnhancedProjectsController, 'streamForEditing'])  // Step 3: Stream for editing
router.post('/v2/projects/:projectId/batch-clips', [EnhancedProjectsController, 'batchProcessClips'])  // Step 4: Batch process

// System maintenance
router.post('/v2/system/check-stuck-downloads', [EnhancedProjectsController, 'checkStuckDownloads'])  // Check stuck downloads
router.post('/v2/system/validate-database', [EnhancedProjectsController, 'validateDatabase'])  // Validate database consistency

// Storage management
router.get('/v2/storage/stats', [EnhancedProjectsController, 'referenceStats'])  // Storage & reference statistics

// Clips API (FRONTEND READY)
router.resource('clips', ClipsController).only(['index', 'show'])
router.post('/clips/render', [ClipsController, 'render'])  // NEW: For frontend
router.post('/clips/render-test', [ClipsController, 'renderTest'])  // NEW: Test mode
router.get('/clips/status/:clipId', [ClipsController, 'status'])  // NEW: Check status
router.post('/clips/:id/process', [ClipsController, 'process'])
router.get('/clips/:id/stream', [ClipsController, 'stream'])

// Static file serving
router.get('/storage/videos/:filename', async ({ params, response }) => {
  const filePath = path.join(process.cwd(), 'storage', 'videos', params.filename)
  
  response.header('Access-Control-Allow-Origin', '*')
  
  if (fs.existsSync(filePath)) {
    response.header('Content-Type', 'video/mp4')
    return response.stream(fs.createReadStream(filePath))
  }
  
  return response.status(404).json({ success: false, message: 'File not found' })
})

router.get('/storage/clips/:filename', async ({ params, response }) => {
  const filePath = path.join(process.cwd(), 'storage', 'clips', params.filename)
  
  response.header('Access-Control-Allow-Origin', '*')
  
  if (fs.existsSync(filePath)) {
    response.header('Content-Type', 'video/mp4')
    return response.stream(fs.createReadStream(filePath))
  }
  
  return response.status(404).json({ success: false, message: 'File not found' })
})

router.get('/storage/downloads/:filename', async ({ params, response }) => {
  const filePath = path.join(process.cwd(), 'storage', 'downloads', params.filename)
  
  response.header('Access-Control-Allow-Origin', '*')
  
  if (fs.existsSync(filePath)) {
    response.header('Content-Type', 'video/mp4')
    response.header('Accept-Ranges', 'bytes')
    response.header('Cache-Control', 'public, max-age=3600')
    return response.stream(fs.createReadStream(filePath))
  }
  
  return response.status(404).json({ success: false, message: 'File not found' })
})

router.get('/storage/thumbnails/:filename', async ({ params, response }) => {
  const filePath = path.join(process.cwd(), 'storage', 'thumbnails', params.filename)
  
  response.header('Access-Control-Allow-Origin', '*')
  
  if (fs.existsSync(filePath)) {
    response.header('Content-Type', 'image/jpeg')
    return response.stream(fs.createReadStream(filePath))
  }
  
  return response.status(404).json({ success: false, message: 'File not found' })
})
