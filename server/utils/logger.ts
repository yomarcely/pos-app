import pino from 'pino'

/**
 * Logger configuré avec Pino
 *
 * Usage:
 * - logger.info('Message')
 * - logger.error({ err }, 'Error message')
 * - logger.debug({ data }, 'Debug info')
 */

const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  // Format de sortie
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    },
  }),

  // Configuration production (JSON structuré)
  ...(!isDevelopment && {
    formatters: {
      level: (label) => {
        return { level: label }
      },
    },
  }),

  // Contexte global
  base: {
    env: process.env.NODE_ENV,
    app: 'pos-app',
  },

  // Serializers pour objets spécifiques
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
})

/**
 * Logger pour les requêtes HTTP avec contexte
 */
export function createRequestLogger(path: string, method: string) {
  return logger.child({ path, method })
}

/**
 * Logger pour un module spécifique
 */
export function createModuleLogger(module: string) {
  return logger.child({ module })
}
