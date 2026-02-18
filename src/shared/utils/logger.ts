/**
 * Logger structuré avec support ANSI et contextes
 *
 * @module shared/utils/logger
 */

/**
 * Niveaux de log supportés
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * Codes de couleurs ANSI pour la console
 */
const ANSI_COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Couleurs
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Fond
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
} as const;

/**
 * Configuration d'un niveau de log
 */
interface LevelConfig {
  name: string;
  color: string;
  prefix: string;
}

/**
 * Configuration des niveaux avec leurs styles visuels
 */
const LEVEL_CONFIGS: Record<LogLevel, LevelConfig> = {
  [LogLevel.DEBUG]: {
    name: 'DEBUG',
    color: ANSI_COLORS.dim,
    prefix: '⚙',
  },
  [LogLevel.INFO]: {
    name: 'INFO',
    color: ANSI_COLORS.blue,
    prefix: 'ℹ',
  },
  [LogLevel.WARN]: {
    name: 'WARN',
    color: ANSI_COLORS.yellow,
    prefix: '⚠',
  },
  [LogLevel.ERROR]: {
    name: 'ERROR',
    color: ANSI_COLORS.red,
    prefix: '✖',
  },
  [LogLevel.SILENT]: {
    name: 'SILENT',
    color: ANSI_COLORS.reset,
    prefix: '',
  },
};

/**
 * Options de configuration du logger
 */
export interface LoggerOptions {
  /** Contexte du logger (ex: nom du module) */
  context?: string;
  /** Niveau minimum de log */
  level?: LogLevel;
  /** Format de sortie */
  format?: 'pretty' | 'json';
  /** Désactiver les couleurs */
  noColor?: boolean;
  /** Timestamp personnalisé */
  timestamp?: boolean | (() => string);
}

/**
 * Métadonnées structurées pour le logging
 */
export interface LogMetadata {
  [key: string]: unknown;
}

/**
 * Entrée de log structurée
 */
export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  context?: string;
  metadata?: LogMetadata;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger structuré avec support ANSI et contextes
 *
 * @example
 * ```ts
 * const logger = new Logger({ context: 'MyModule' });
 * logger.info('Démarrage du module');
 * logger.warn('Attention', { detail: 'valeur manquante' });
 *
 * // Contexte imbriqué
 * const dbLogger = logger.createContext('Database');
 * dbLogger.error('Erreur de connexion', new Error('ECONNREFUSED'));
 * ```
 */
export class Logger {
  private readonly context: string | undefined;
  private level: LogLevel;
  private readonly format: 'pretty' | 'json';
  private readonly noColor: boolean;
  private readonly timestampFn: () => string;

  // État global partagé
  private static globalLevel: LogLevel | null = null;
  private static globalNoColor: boolean | null = null;

  /**
   * Crée une nouvelle instance de Logger
   */
  constructor(options: LoggerOptions = {}) {
    this.context = options.context;
    this.level = options.level ?? Logger.globalLevel ?? LogLevel.INFO;
    this.format = options.format ?? 'pretty';
    this.noColor = options.noColor ?? Logger.globalNoColor ?? false;
    this.timestampFn =
      typeof options.timestamp === 'function'
        ? options.timestamp
        : options.timestamp === false
          ? () => ''
          : () => new Date().toISOString();
  }

  /**
   * Définit le niveau de log global
   */
  static setGlobalLevel(level: LogLevel): void {
    Logger.globalLevel = level;
  }

  /**
   * Définit l'option de couleur globale
   */
  static setGlobalNoColor(noColor: boolean): void {
    Logger.globalNoColor = noColor;
  }

  /**
   * Définit le niveau de log pour cette instance
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Retourne le niveau de log actuel
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Log un message de niveau DEBUG
   */
  debug(message: string, meta?: unknown): void {
    this.log(LogLevel.DEBUG, message, meta);
  }

  /**
   * Log un message de niveau INFO
   */
  info(message: string, meta?: unknown): void {
    this.log(LogLevel.INFO, message, meta);
  }

  /**
   * Log un message de niveau WARN
   */
  warn(message: string, meta?: unknown): void {
    this.log(LogLevel.WARN, message, meta);
  }

  /**
   * Log un message de niveau ERROR
   */
  error(message: string, error?: Error | unknown): void {
    let meta: LogMetadata | undefined;

    if (error instanceof Error) {
      meta = {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      };
    } else if (error !== undefined) {
      meta = { error };
    }

    this.log(LogLevel.ERROR, message, meta);
  }

  /**
   * Log un message de succès (vert)
   */
  success(message: string, meta?: unknown): void {
    const level = LogLevel.INFO;
    if (level < this.level) {
      return;
    }

    const timestamp = this.timestampFn();
    const config = LEVEL_CONFIGS[level];

    if (this.format === 'json') {
      this.logJson(level, message, meta, timestamp);
    } else {
      this.logSuccess(message, meta, timestamp);
    }
  }

  /**
   * Log au format succès avec couleur verte
   */
  private logSuccess(
    message: string,
    meta: unknown,
    timestamp: string
  ): void {
    const parts: string[] = [];

    // Timestamp
    if (timestamp) {
      const tsColor = this.noColor ? '' : ANSI_COLORS.dim;
      const tsReset = this.noColor ? '' : ANSI_COLORS.reset;
      parts.push(`${tsColor}${timestamp}${tsReset}`);
    }

    // Contexte
    if (this.context) {
      const ctxColor = this.noColor ? '' : ANSI_COLORS.cyan;
      const ctxReset = this.noColor ? '' : ANSI_COLORS.reset;
      parts.push(`${ctxColor}[${this.context}]${ctxReset}`);
    }

    // Succès avec coche verte
    const successColor = this.noColor ? '' : ANSI_COLORS.green;
    const successReset = this.noColor ? '' : ANSI_COLORS.reset;
    parts.push(`${successColor}✓ SUCCESS${successReset}`);

    // Message
    parts.push(message);

    const prefix = parts.join(' ');

    // Affichage
    if (meta !== undefined) {
      const normalized = this.normalizeMetadata(meta);
      const metaStr = this.noColor
        ? JSON.stringify(normalized, null, 2)
        : this.colorizeJson(normalized);
      console.log(`${prefix} ${metaStr}`);
    } else {
      console.log(prefix);
    }
  }

  /**
   * Crée un nouveau logger avec un contexte imbriqué
   */
  createContext(context: string): Logger {
    const fullContext = this.context ? `${this.context}:${context}` : context;
    return new Logger({
      context: fullContext,
      level: this.level,
      format: this.format,
      noColor: this.noColor,
      timestamp: this.timestampFn !== (() => ''),
    });
  }

  /**
   * Log interne avec gestion du niveau et du format
   */
  private log(level: LogLevel, message: string, meta?: unknown): void {
    if (level < this.level) {
      return;
    }

    const timestamp = this.timestampFn();
    const config = LEVEL_CONFIGS[level];

    if (this.format === 'json') {
      this.logJson(level, message, meta, timestamp);
    } else {
      this.logPretty(level, message, meta, timestamp, config);
    }
  }

  /**
   * Log au format JSON structuré
   */
  private logJson(
    level: LogLevel,
    message: string,
    meta: unknown,
    timestamp: string
  ): void {
    const entry: LogEntry = {
      level: LEVEL_CONFIGS[level].name,
      message,
      timestamp,
    };

    if (this.context) {
      entry.context = this.context;
    }

    if (meta !== undefined) {
      entry.metadata = this.normalizeMetadata(meta);
    }

    console.log(JSON.stringify(entry));
  }

  /**
   * Log au format pretty avec couleurs ANSI
   */
  private logPretty(
    level: LogLevel,
    message: string,
    meta: unknown,
    timestamp: string,
    config: LevelConfig
  ): void {
    const parts: string[] = [];

    // Timestamp
    if (timestamp) {
      const tsColor = this.noColor ? '' : ANSI_COLORS.dim;
      const tsReset = this.noColor ? '' : ANSI_COLORS.reset;
      parts.push(`${tsColor}${timestamp}${tsReset}`);
    }

    // Contexte
    if (this.context) {
      const ctxColor = this.noColor ? '' : ANSI_COLORS.cyan;
      const ctxReset = this.noColor ? '' : ANSI_COLORS.reset;
      parts.push(`${ctxColor}[${this.context}]${ctxReset}`);
    }

    // Niveau
    const levelColor = this.noColor ? '' : config.color;
    const levelReset = this.noColor ? '' : ANSI_COLORS.reset;
    parts.push(`${levelColor}${config.prefix} ${config.name}${levelReset}`);

    // Message
    parts.push(message);

    const prefix = parts.length > 0 ? `${parts.join(' ')} ` : '';

    // Affichage
    if (meta !== undefined) {
      const normalized = this.normalizeMetadata(meta);
      const metaStr = this.noColor
        ? JSON.stringify(normalized, null, 2)
        : this.colorizeJson(normalized);
      console.log(`${prefix}${metaStr}`);
    } else {
      console.log(prefix);
    }
  }

  /**
   * Normalise les métadonnées en objet plat
   */
  private normalizeMetadata(meta: unknown): LogMetadata {
    if (meta === null) {
      return {};
    }

    if (typeof meta === 'string') {
      return { message: meta };
    }

    if (typeof meta === 'object') {
      return meta as LogMetadata;
    }

    return { value: meta };
  }

  /**
   * Colore une sortie JSON pour la console
   */
  private colorizeJson(obj: unknown, indent = 0): string {
    const indentStr = '  '.repeat(indent);
    const nextIndentStr = '  '.repeat(indent + 1);

    if (obj === null) {
      return this.noColor ? 'null' : `${ANSI_COLORS.dim}null${ANSI_COLORS.reset}`;
    }

    if (typeof obj === 'string') {
      const value = JSON.stringify(obj);
      return this.noColor
        ? value
        : `${ANSI_COLORS.green}${value}${ANSI_COLORS.reset}`;
    }

    if (typeof obj === 'number') {
      const value = String(obj);
      return this.noColor
        ? value
        : `${ANSI_COLORS.magenta}${value}${ANSI_COLORS.reset}`;
    }

    if (typeof obj === 'boolean') {
      const value = String(obj);
      return this.noColor
        ? value
        : `${ANSI_COLORS.yellow}${value}${ANSI_COLORS.reset}`;
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return '[]';
      }
      const items = obj.map((item) =>
        this.colorizeJson(item, indent + 1)
      );
      return `[\n${items.map((i) => `${nextIndentStr}${i}`).join(',\n')}\n${indentStr}]`;
    }

    if (typeof obj === 'object') {
      const entries = Object.entries(obj as Record<string, unknown>);
      if (entries.length === 0) {
        return '{}';
      }
      const pairs = entries.map(([key, value]) => {
        const coloredKey = this.noColor
          ? JSON.stringify(key)
          : `${ANSI_COLORS.blue}${JSON.stringify(key)}${ANSI_COLORS.reset}`;
        return `${coloredKey}: ${this.colorizeJson(value, indent + 1)}`;
      });
      return `{\n${pairs.map((p) => `${nextIndentStr}${p}`).join(',\n')}\n${indentStr}}`;
    }

    return String(obj);
  }
}

/**
 * Logger racine sans contexte
 */
export const rootLogger = new Logger();

/**
 * Crée un nouveau logger avec un contexte
 *
 * @example
 * ```ts
 * import { createLogger } from './logger';
 *
 * const logger = createLogger('MyModule');
 * logger.info('Hello world');
 * ```
 */
export function createLogger(context: string, options?: Omit<LoggerOptions, 'context'>): Logger {
  return new Logger({ ...options, context });
}

/**
 * Logger global pour les usages simples
 */
export const logger = rootLogger;
