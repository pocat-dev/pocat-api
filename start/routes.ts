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
    version: '2.0.0',
    description: 'AI Video Clipper API - Transform long videos into engaging clips',
    message: 'Welcome to Pocat.io - Your AI Video Clipper Backend',
    ngrok_url: 'https://nonimitating-corie-extemporary.ngrok-free.dev/',
    workflows: {
      v1_demo_mode: {
        description: 'Direct clip rendering with demo mode fallback',
        endpoints: {
          'POST /clips/render': 'Create demo clip immediately',
          'GET /clips/status/:clipId': 'Check clip status'
        }
      },
      v2_enhanced_mode: {
        description: 'Download-first workflow for real video processing',
        flow: [
          '1. POST /v2/projects - Create project & start download',
          '2. GET /v2/projects/:id/download-status - Check download progress', 
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
      'POST /v2/projects': '📥 Create project & download video',
      'GET /v2/projects/:id/download-status': '📊 Check download progress',
      'GET /v2/projects/:id/stream': '🎬 Stream video for editing',
      'POST /v2/projects/:id/batch-clips': '✂️ Batch process AI clips',
      
      // Static Files
      'GET /storage/clips/*': 'Access processed clips',
      'GET /storage/downloads/*': 'Access downloaded videos'
    },
    example_v2_workflow: {
      step1: {
        method: 'POST',
        url: '/v2/projects',
        body: {
          title: 'My Video Project',
          youtubeUrl: 'https://youtube.com/watch?v=...',
          userId: 1,
          quality: '720p'
        }
      },
      step2: {
        method: 'GET', 
        url: '/v2/projects/1/download-status',
        response: { downloaded: true, readyForEditing: true }
      },
      step3: {
        method: 'GET',
        url: '/v2/projects/1/stream',
        headers: { Range: 'bytes=0-1023' }
      },
      step4: {
        method: 'POST',
        url: '/v2/projects/1/batch-clips',
        body: {
          clips: [
            { startTime: 10, endTime: 40, title: 'Intro', aspectRatio: '9:16' },
            { startTime: 60, endTime: 90, title: 'Main Point', aspectRatio: '16:9' }
          ]
        }
      }
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
router.post('/v2/projects', [EnhancedProjectsController, 'create'])  // Step 1: Create + Download
router.get('/v2/projects/:projectId/download-status', [EnhancedProjectsController, 'downloadStatus'])  // Step 2: Check status
router.get('/v2/projects/:projectId/stream', [EnhancedProjectsController, 'streamForEditing'])  // Step 3: Stream for editing
router.post('/v2/projects/:projectId/batch-clips', [EnhancedProjectsController, 'batchProcessClips'])  // Step 4: Batch process

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

router.get('/storage/thumbnails/:filename', async ({ params, response }) => {
  const filePath = path.join(process.cwd(), 'storage', 'thumbnails', params.filename)
  
  response.header('Access-Control-Allow-Origin', '*')
  
  if (fs.existsSync(filePath)) {
    response.header('Content-Type', 'image/jpeg')
    return response.stream(fs.createReadStream(filePath))
  }
  
  return response.status(404).json({ success: false, message: 'File not found' })
})
