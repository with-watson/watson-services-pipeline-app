'use strict'

const watson = require('watson-developer-cloud')

module.exports = function (WatsonTTS) {

    WatsonTTS.getToken = function (cb) {
        let ttsConfig = {
            version: 'v1',
            url: 'https://stream.watsonplatform.net/text-to-speech/api',
            username: process.env.WATSON_TTS_USERNAME,
            password: process.env.WATSON_TTS_PASSWORD,
            iam_apikey: process.env.WATSON_TTS_APIKEY
        }
        var ttsAuthService = watson.authorization(ttsConfig);
        ttsAuthService.getToken({url: ttsConfig.url}, (err, token) => {
            if (err) return cb(err)
            cb(null, { token: token })
        })
    }
    
}
