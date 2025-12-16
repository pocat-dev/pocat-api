import { createClient } from '@libsql/client'
import env from '#start/env'

class TursoService {
  private client: ReturnType<typeof createClient>

  constructor() {
    const url = env.get('DATABASE_URL')
    const authToken = env.get('DATABASE_AUTH_TOKEN')
    
    if (!url || !authToken) {
      throw new Error('DATABASE_URL and DATABASE_AUTH_TOKEN must be set')
    }

    this.client = createClient({
      url,
      authToken,
    })
  }

  async execute(sql: string, params?: any[]) {
    return await this.client.execute({
      sql,
      args: params || [],
    })
  }

  async batch(statements: Array<{ sql: string; args?: any[] }>) {
    return await this.client.batch(statements)
  }

  async close() {
    this.client.close()
  }
}

export default new TursoService()
