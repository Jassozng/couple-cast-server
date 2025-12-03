import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import multer from "multer"

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

const upload = multer()
const rooms = {}
const roomVideos = {}

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

    if (roomVideos[roomId]) {
      socket.emit("video-ready", { roomId })
    }

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

app.post("/upload/:roomId", upload.single("video"), (req, res) => {
  const roomId = req.params.roomId
  if (!req.file) {
    res.status(400).json({ error: "No file" })
    return
  }

  roomVideos[roomId] = {
    buffer: req.file.buffer,
    mimeType: req.file.mimetype || "video/mp4"
  }

  io.to(roomId).emit("video-ready", { roomId })
  res.json({ ok: true })
})

app.get("/video/:roomId", (req, res) => {
  const roomId = req.params.roomId
  const video = roomVideos[roomId]
  if (!video) {
    res.status(404).send("No video for this room")
    return
  }

  res.setHeader("Content-Type", video.mimeType)
  res.setHeader("Accept-Ranges", "bytes")
  res.send(video.buffer)
})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Sync server on http://localhost:${PORT}`)
})
