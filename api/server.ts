/**
 * local server entry file, for local development
 */
import app from './app.js';
import { ScheduledEvaluationService } from './services/ScheduledEvaluationService.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 6077;

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  console.log('Scheduled evaluation scheduler started');
});

const SCHEDULER_INTERVAL_MS = 30 * 1000;
const schedulerTimer = setInterval(() => {
  try {
    ScheduledEvaluationService.tick();
  } catch (e) {
    console.error('Scheduled evaluation tick error:', e);
  }
}, SCHEDULER_INTERVAL_MS);

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  clearInterval(schedulerTimer);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  clearInterval(schedulerTimer);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;