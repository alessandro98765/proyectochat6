import express from 'express'
import logger from 'morgan'
import dotenv from 'dotenv'
import { createClient } from '@libsql/client'
import { Server } from 'socket.io'
import { createServer } from 'node:http'

dotenv.config()

const port = process.env.PORT ?? 3000
const app = express()
const server = createServer(app)
const io = new Server(server)

const db = createClient({
  url: "libsql://proyectochat6-alessandro98765.aws-us-west-2.turso.io",
  authToken: process.env.DB_TOKEN
})

// 🧱 Crear tabla si no existe
await db.execute(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    user TEXT
  )
`)

io.on('connection', async (socket) => {
  const username = socket.handshake.auth.username ?? 'anonymous'
  console.log(`🟢 ${username} conectado`)

  // ✅ Cuando un usuario se conecta, enviarle todos los mensajes guardados
  try {
    const result = await db.execute(`
      SELECT id, content, user FROM messages ORDER BY id ASC
    `)
    result.rows.forEach(row => {
      socket.emit('chat message', row.content, row.id.toString(), row.user)
    })
  } catch (error) {
    console.error('Error al cargar mensajes:', error)
  }

  // 📩 Cuando el usuario envía un nuevo mensaje
  socket.on('chat message', async (msg) => {
    let result
    try {
      result = await db.execute({
        sql: 'INSERT INTO messages (content, user) VALUES (:msg, :username)',
        args: { msg, username }
      })
    } catch (e) {
      console.error('Error al guardar el mensaje:', e)
      return
    }

    // 🔁 Enviar el mensaje a todos los usuarios conectados
    io.emit('chat message', msg, result.lastInsertRowid.toString(), username)
  })

  socket.on('disconnect', () => {
    console.log(`🔴 ${username} desconectado`)
  })
})

app.use(logger('dev'))
app.use(express.static('client'))

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/client/index.html')
})

server.listen(port, () => {
  console.log(`🚀 Servidor funcionando en el puerto ${port}`)
})


