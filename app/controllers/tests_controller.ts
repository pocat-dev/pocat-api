import type { HttpContext } from '@adonisjs/core/http'
import tursoService from '#services/turso_service'

export default class TestsController {
  async index({ response }: HttpContext) {
    try {
      // Test connection dengan query sederhana
      const result = await tursoService.execute('SELECT 1 as test')
      
      return response.json({
        success: true,
        message: 'Turso connection successful',
        data: result.rows
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Turso connection failed',
        error: error.message
      })
    }
  }

  async createTable({ response }: HttpContext) {
    try {
      await tursoService.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      
      return response.json({
        success: true,
        message: 'Table created successfully'
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to create table',
        error: error.message
      })
    }
  }
}