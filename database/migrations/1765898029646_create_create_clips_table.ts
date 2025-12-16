import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'clips'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('video_project_id').unsigned().references('video_projects.id').onDelete('CASCADE')
      table.string('title').notNullable()
      table.integer('start_time').notNullable() // in seconds
      table.integer('end_time').notNullable() // in seconds
      table.text('transcript_segment').nullable()
      table.string('output_url').nullable()
      table.string('subtitle_url').nullable()
      table.decimal('engagement_score', 3, 2).nullable() // AI-calculated score 0-1
      table.json('ai_analysis').nullable() // sentiment, keywords, etc
      table.enum('status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending')
      
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}