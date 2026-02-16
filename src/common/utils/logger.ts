import * as winston from "winston";
import path from "path";

const logDir = process.env.LOG_FILE || "./logs/app.log";
const logLevel = process.env.LOG_LEVEL || "info";

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
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
  defaultMeta: { service: "lost-and-found-api" },
  transports: [
    new winston.transports.File({
      filename: path.join(path.dirname(logDir), "error.log"),
      level: "error",
      maxsize: 5242880,
      maxFiles: 5,
    } as ConstructorParameters<typeof winston.transports.File>[0] & { level?: string }),

    new winston.transports.File({
      filename: logDir,
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      level: logLevel,
      format: consoleFormat,
    } as ConstructorParameters<typeof winston.transports.Console>[0] & { level?: string }),
  );
}

export default logger;
