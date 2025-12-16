import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import tursoService from '#services/turso_service'

export default class TestTurso extends BaseCommand {
  static commandName = 'test:turso'
  static description = 'Test Turso database connection'

  static options: CommandOptions = {}

  async run() {
    try {
      this.logger.info('Testing Turso connection...')
      
      // Test basic connection
      const result = await tursoService.execute('SELECT 1 as test')
      this.logger.success('✅ Turso connection successful!')
      this.logger.info(`Result: ${JSON.stringify(result.rows)}`)
      
      // Test creating a table
      this.logger.info('Creating test table...')
      await tursoService.execute(`
        CREATE TABLE IF NOT EXISTS test_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      this.logger.success('✅ Table created successfully!')
      
      // Test inserting data
      this.logger.info('Inserting test data...')
      await tursoService.execute(
        'INSERT INTO test_users (name, email) VALUES (?, ?)',
        ['John Doe', 'john@example.com']
      )
      this.logger.success('✅ Data inserted successfully!')
      
      // Test querying data
      this.logger.info('Querying test data...')
      const users = await tursoService.execute('SELECT * FROM test_users')
      this.logger.success('✅ Data queried successfully!')
      this.logger.info(`Users: ${JSON.stringify(users.rows)}`)
      
    } catch (error) {
      this.logger.error('❌ Turso connection failed!')
      this.logger.error(error.message)
      this.exitCode = 1
    }
  }
}