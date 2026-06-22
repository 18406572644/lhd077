import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import knowledgeRoutes from './routes/knowledge.js'
import qaRoutes from './routes/qa.js'
import evaluationRoutes from './routes/evaluation.js'
import compareRoutes from './routes/compare.js'
import logRoutes from './routes/logs.js'
import metricsRoutes from './routes/metrics.js'
import backupRoutes from './routes/backup.js'
import { ensureAllDirs } from './data/storage.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()
ensureAllDirs()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/knowledge', knowledgeRoutes)
app.use('/api/qa', qaRoutes)
app.use('/api/evaluation', evaluationRoutes)
app.use('/api/compare', compareRoutes)
app.use('/api/logs', logRoutes)
app.use('/api/metrics', metricsRoutes)
app.use('/api/backup', backupRoutes)

app.use(
  '/api/health',
  (_req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: error.message || 'Server internal error',
  })
})

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
