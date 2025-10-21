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

// 🧹 Crear tabla si no existe (estructura básica)
await db.execute(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    user TEXT
  )
`)

// 🧹 Vaciar mensajes cada vez que el servidor se inicia
await db.execute(`DELETE FROM messages`)

io.on('connection', (socket) => {
  const username = socket.handshake.auth.username ?? 'anonymous'
  console.log(`🟢 ${username} conectado`)

  socket.on('disconnect', () => {
    console.log(`🔴 ${username} desconectado`)
  })

  // 📩 Cuando el usuario envía un mensaje
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
})

app.use(logger('dev'))
app.use(express.static('client'))

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/client/index.html')
})

server.listen(port, () => {
  console.log(`🚀 Servidor funcionando en el puerto ${port}`)
})

