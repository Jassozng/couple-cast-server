import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

const rooms = {}

io.on("connection", socket => {
  socket.on("join", ({ roomId, userName }) => {
    socket.join(roomId)

    if (!rooms[roomId]) {
      rooms[roomId] = {
        isPlaying: false,
        currentTime: 0,
        updatedAt: Date.now()
      }
    }

    socket.emit("state", rooms[roomId])
    socket.to(roomId).emit("user-joined", { userName })
  })

  socket.on("action", ({ roomId, type, payload }) => {
    const room = rooms[roomId]
    if (!room) return

    if (payload && typeof payload.currentTime === "number") {
      room.currentTime = payload.currentTime
    }

    if (type === "play") room.isPlaying = true
    if (type === "pause") room.isPlaying = false
    if (type === "seek") room.isPlaying = room.isPlaying

    room.updatedAt = Date.now()

    socket.to(roomId).emit("action", {
      type,
      payload: {
        currentTime: room.currentTime,
        at: room.updatedAt
      }
    })
  })
})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Sync server on http://localhost:${PORT}`)
})
