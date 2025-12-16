import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import VideoProject from './video_project.js'

export default class Clip extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare videoProjectId: number

  @column()
  declare title: string

  @column()
  declare startTime: number

  @column()
  declare endTime: number

  @column()
  declare transcriptSegment: string | null

  @column()
  declare outputUrl: string | null

  @column()
  declare subtitleUrl: string | null

  @column()
  declare engagementScore: number | null

  @column()
  declare aiAnalysis: object | null

  @column()
  declare status: 'pending' | 'processing' | 'completed' | 'failed'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => VideoProject)
  declare videoProject: BelongsTo<typeof VideoProject>
}