import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import tursoService from '#services/turso_service'

export default class MigrateTurso extends BaseCommand {
  static commandName = 'migrate:turso'
  static description = 'Run migrations on Turso database'

  static options: CommandOptions = {}

  async run() {
    try {
      this.logger.info('Running migrations on Turso database...')
      
      // Create users table
      await tursoService.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      this.logger.success('✅ Users table created!')
      
      // Create video_projects table
      await tursoService.execute(`
        CREATE TABLE IF NOT EXISTS video_projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          youtube_url TEXT,
          video_file_path TEXT,
          transcription TEXT,
          video_metadata TEXT,
          status TEXT DEFAULT 'pending',
          duration INTEGER,
          thumbnail_url TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `)
      this.logger.success('✅ Video projects table created!')
      
      // Create clips table
      await tursoService.execute(`
        CREATE TABLE IF NOT EXISTS clips (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          video_project_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          start_time INTEGER NOT NULL,
          end_time INTEGER NOT NULL,
          transcript_segment TEXT,
          output_url TEXT,
          subtitle_url TEXT,
          engagement_score REAL,
          ai_analysis TEXT,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (video_project_id) REFERENCES video_projects(id) ON DELETE CASCADE
        )
      `)
      this.logger.success('✅ Clips table created!')
      
      // Create access tokens table
      await tursoService.execute(`
        CREATE TABLE IF NOT EXISTS access_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tokenable_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          name TEXT,
          hash TEXT NOT NULL,
          abilities TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_used_at DATETIME,
          expires_at DATETIME,
          FOREIGN KEY (tokenable_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `)
      this.logger.success('✅ Access tokens table created!')
      
      this.logger.success('🎉 All migrations completed successfully!')
      
    } catch (error) {
      this.logger.error('❌ Migration failed!')
      this.logger.error(error.message)
      this.exitCode = 1
    }
  }
}