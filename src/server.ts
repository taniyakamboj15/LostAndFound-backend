import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import connectDB from './config/database';
import { connectRedis } from './config/redis';
import jobService from './modules/common/job.service';
import { Server } from 'http';
import logger from './common/utils/logger';

const PORT = process.env.PORT || 5000;

const shutdownServer = (server?: Server) => {
  const msg = 'Shutting down gracefully...';
  if (logger) logger.info(msg);
  else console.log(msg);

  if (server) {
    server.close(() => {
      const closedMsg = 'HTTP server closed';
      if (logger) logger.info(closedMsg);
      else console.log(closedMsg);
      process.exit(0);
    });
  } else {
    process.exit(0);
  }

  setTimeout(() => {
    const forcedMsg = 'Forced shutdown after timeout';
    if (logger) logger.error(forcedMsg);
    else console.error(forcedMsg);
    process.exit(1);
  }, 10000);
};

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  const errorStack = reason instanceof Error ? reason.stack : undefined;
  
  const logMsg = 'Unhandled Rejection detected';
  const logData = {
    reason: errorMessage,
    stack: errorStack,
    promise: String(promise),
  };

  if (logger) logger.error(logMsg, logData);
  else console.error(logMsg, logData);
  
  if (process.env.NODE_ENV !== 'production') {
    const warnMsg = 'Unhandled rejection in development mode - consider fixing this';
    if (logger) logger.warn(warnMsg);
    else console.warn(warnMsg);
  }
});

process.on('uncaughtException', (error: Error) => {
  const logMsg = 'Uncaught Exception - Critical Error';
  const logData = {
    message: error.message,
    stack: error.stack,
    name: error.name,
  };

  if (logger) logger.error(logMsg, logData);
  else console.error(logMsg, logData);
  
  shutdownServer();
});

async function startServer(): Promise<void> {
  let server: Server;
  try {
    await connectDB();
    await connectRedis();

    await jobService.initializeRepeatableJobs();

    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    });

    process.on('SIGINT', () => shutdownServer(server));
    process.on('SIGTERM', () => shutdownServer(server));

  } catch (error) {
    const failMsg = 'Failed to start server:';
    if (logger) logger.error(failMsg, error);
    else console.error(failMsg, error);
    process.exit(1);
  }
}

startServer();
