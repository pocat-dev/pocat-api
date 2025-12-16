import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from './user.js'
import Clip from './clip.js'

export default class VideoProject extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare title: string

  @column()
  declare youtubeUrl: string | null

  @column()
  declare videoFilePath: string | null

  @column()
  declare transcription: string | null

  @column()
  declare videoMetadata: object | null

  @column()
  declare status: 'pending' | 'processing' | 'completed' | 'failed'

  @column()
  declare duration: number | null

  @column()
  declare thumbnailUrl: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => Clip)
  declare clips: HasMany<typeof Clip>
}