import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'video_projects'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').unsigned().references('users.id').onDelete('CASCADE')
      table.string('title').notNullable()
      table.string('youtube_url').nullable()
      table.string('video_file_path').nullable()
      table.text('transcription').nullable()
      table.json('video_metadata').nullable()
      table.enum('status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending')
      table.integer('duration').nullable()
      table.string('thumbnail_url').nullable()
      
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}