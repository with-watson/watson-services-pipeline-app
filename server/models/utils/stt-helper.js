'use strict'

const LOG = require('../../utils/logger.js')

const fs = require('fs')
const request = require('request')

// Configure the Speech To Text Service with the Credentials
const SpeechToTextV1 = require('watson-developer-cloud/speech-to-text/v1');
var speechToText = new SpeechToTextV1({
    username: process.env.STT_API_USERNAME,
    password: process.env.STT_API_PASSWORD,
    url: process.env.STT_API_URL
})

const DEFAULT_PARAMS = {
    model: 'en-US_BroadbandModel',
    content_type: 'audio/ogg',
    timestamps: true,
    objectMode: true
}

function SttHelper() { }

SttHelper.prototype.streamAudioFromMulterResource = function (params, file, cb) {
    
    params = Object.assign(DEFAULT_PARAMS, params)
    var recognizeStream = speechToText.createRecognizeStream(params)

    // Stream the audio to STT
    file.stream.pipe(recognizeStream);

    // Get strings instead of buffers from 'data' events.
    let buffer = []
    // Listen for events.
    recognizeStream.on('data', (data) => {
        if (data.results && data.results[0] && data.results[0].final && data.results[0].alternatives) {
            buffer.push(data)
        }
    })
    recognizeStream.on('error', (err) => {
        LOG.error(err)
        cb(err)
    })
    recognizeStream.on('end', (event) => {
        LOG.debug('Done Streaming Audio...')
        cb(null, buffer)
    });
}

SttHelper.prototype.streamAudioFromCosResource = function (readUrl, sttParams, cb) {

    let startTime = new Date()

    sttParams = Object.assign(DEFAULT_PARAMS, sttParams)
    let recognizeStream = speechToText.createRecognizeStream(sttParams)

    LOG.info('Recognize Stream created...')

    let buffer = []
    // Listen for events.
    recognizeStream.on('data', (data) => {
        if (data.results && data.results[0] && data.results[0].final && data.results[0].alternatives) {
            buffer.push(data)
        }
    })
    recognizeStream.on('error', (err) => {
        LOG.error(err)
        cb(err)
    })
    recognizeStream.on('close', (event) => {
        let diff = (new Date() - startTime) / 1000
        LOG.debug('Done transcribing Audio in ' + diff + ' seconds.')
        cb(null, buffer)
    })
    // Create the Request Parameters with a no-cache
    let params = {
        url: readUrl,
        headers: {
            'Cache-Control': 'no-cache'
        }
    }
    let totalReceived = 0
    // Stream the audio to STT
    request.get(params, (err, res, body) => {
        if (err) {
            LOG.error('1. Error Streaming read url to STT...')
            return LOG.error(err)
        }
        if (res.statusCode >= 300) {
            LOG.error('2. Error Streaming read url to STT...')
            LOG.error(body)
        }
        LOG.debug('Audio file successfully streamed from COS...')
    })
    .on('end', () => {
        LOG.debug('End of streaming URL data.  Received ' + Math.round(totalReceived / (1024 * 1024)) + ' MB of data...')
    })
    .on('data', (chunks) => {
        totalReceived += chunks.length
    }).pipe(recognizeStream)
}

module.exports = new SttHelper()