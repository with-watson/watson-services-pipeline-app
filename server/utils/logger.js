'use strict'

const winston = require('winston')

const console = new winston.transports.Console()

const DEFAULT_LEVEL = 'debug'

var logger = function() {

    const customFormat = winston.format.printf(log => {
        return `${log.timestamp} ${log.level}: ${log.message}`;
    })

    this.LOG = winston.createLogger({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.splat(),
            winston.format.timestamp(),
            customFormat
        ),
        transports: console,
        level: DEFAULT_LEVEL
    })    
}

logger.prototype.setLevel = function (level) {
    this.LOG.level = level
}

logger.prototype.log = function (level, msg, ...args) {
    this.LOG.log(level, msg, ...args)
}

logger.prototype.error = function (msg, ...args) {
    this.LOG.error(msg, ...args)
}

logger.prototype.warn = function (msg, ...args) {
    this.LOG.warn(msg, ...args)
}

logger.prototype.info = function (msg, ...args) {
    this.LOG.info(msg, ...args)
}

logger.prototype.verbose = function (msg, ...args) {
    this.LOG.verbose(msg, ...args)
}

logger.prototype.debug = function (msg, ...args) {
    this.LOG.debug(msg, ...args)
}

logger.prototype.silly = function (msg, ...args) {
    this.LOG.silly(msg, ...args)
}

module.exports = new logger()