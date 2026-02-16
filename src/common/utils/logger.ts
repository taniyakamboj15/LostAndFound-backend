import winston from 'winston';
import path from 'path';

const logDir = process.env.LOG_FILE || './logs/app.log';
const logLevel = process.env.LOG_LEVEL || 'info';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'lost-and-found-api' },
  transports: [
    new winston.transports.File({
      filename: path.join(path.dirname(logDir), 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    } as any), // Winston types don't include all properties
    new winston.transports.File({
      filename: logDir,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});


if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    } as any) // Winston types don't include format property
  );
}

export default logger;
