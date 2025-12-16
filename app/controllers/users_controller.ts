import type { HttpContext } from '@adonisjs/core/http'
import tursoService from '#services/turso_service'
import hash from '@adonisjs/core/services/hash'

export default class UsersController {
  async index({ response }: HttpContext) {
    try {
      const result = await tursoService.execute('SELECT id, name, email, created_at FROM users ORDER BY created_at DESC')
      
      return response.json({
        success: true,
        data: result.rows
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to fetch users',
        error: error.message
      })
    }
  }

  async store({ request, response }: HttpContext) {
    try {
      const { name, email, password } = request.only(['name', 'email', 'password'])
      
      if (!name || !email || !password) {
        return response.status(400).json({
          success: false,
          message: 'Name, email, and password are required'
        })
      }

      const hashedPassword = await hash.make(password)
      
      const result = await tursoService.execute(
        'INSERT INTO users (name, email, password, created_at, updated_at) VALUES (?, ?, ?, datetime("now"), datetime("now"))',
        [name, email, hashedPassword]
      )
      
      return response.status(201).json({
        success: true,
        message: 'User created successfully',
        data: { id: result.lastInsertRowid, name, email }
      })
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return response.status(409).json({
          success: false,
          message: 'Email already exists'
        })
      }
      
      return response.status(500).json({
        success: false,
        message: 'Failed to create user',
        error: error.message
      })
    }
  }

  async show({ params, response }: HttpContext) {
    try {
      const result = await tursoService.execute(
        'SELECT id, name, email, created_at FROM users WHERE id = ?',
        [params.id]
      )
      
      if (result.rows.length === 0) {
        return response.status(404).json({
          success: false,
          message: 'User not found'
        })
      }
      
      return response.json({
        success: true,
        data: result.rows[0]
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to fetch user',
        error: error.message
      })
    }
  }

  async update({ params, request, response }: HttpContext) {
    try {
      const { name, email } = request.only(['name', 'email'])
      
      if (!name && !email) {
        return response.status(400).json({
          success: false,
          message: 'At least name or email is required'
        })
      }

      const updates = []
      const values = []
      
      if (name) {
        updates.push('name = ?')
        values.push(name)
      }
      
      if (email) {
        updates.push('email = ?')
        values.push(email)
      }
      
      updates.push('updated_at = datetime("now")')
      values.push(params.id)
      
      const result = await tursoService.execute(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      )
      
      if (result.rowsAffected === 0) {
        return response.status(404).json({
          success: false,
          message: 'User not found'
        })
      }
      
      return response.json({
        success: true,
        message: 'User updated successfully'
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to update user',
        error: error.message
      })
    }
  }

  async destroy({ params, response }: HttpContext) {
    try {
      const result = await tursoService.execute(
        'DELETE FROM users WHERE id = ?',
        [params.id]
      )
      
      if (result.rowsAffected === 0) {
        return response.status(404).json({
          success: false,
          message: 'User not found'
        })
      }
      
      return response.json({
        success: true,
        message: 'User deleted successfully'
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to delete user',
        error: error.message
      })
    }
  }
}