import { createClient } from '@libsql/client'
import env from '#start/env'

class TursoService {
  private client: ReturnType<typeof createClient> | null = null

  constructor() {
    // Skip Turso initialization in development
    if (env.get('NODE_ENV') === 'development') {
      return
    }
    
    const url = env.get('TURSO_DATABASE_URL')
    const authToken = env.get('TURSO_AUTH_TOKEN')
    
    // Only initialize Turso if we have real credentials
    if (url && authToken && 
        url !== 'your-turso-database-url' && 
        authToken !== 'your-turso-auth-token') {
      
      this.client = createClient({
        url,
        authToken,
      })
    }
  }

  async execute(sql: string, params: any[] = []) {
    if (!this.client) {
      throw new Error('Turso client not initialized. Use Lucid ORM for development.')
    }
    
    const result = await this.client.execute({
      sql,
      args: params,
    })
    return result
  }

  async batch(statements: Array<{ sql: string; args?: any[] }>) {
    if (!this.client) {
      throw new Error('Turso client not initialized. Use Lucid ORM for development.')
    }
    
    const result = await this.client.batch(statements)
    return result
  }
}

export default new TursoService()
