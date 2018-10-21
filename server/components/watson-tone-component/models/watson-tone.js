'use strict'

const ToneAnalyzerV3 = require('watson-developer-cloud/tone-analyzer/v3');

const toneAnalyzer = new ToneAnalyzerV3({
  username: process.env.WATSON_TONE_USERNAME,
  password: process.env.WATSON_TONE_PASSWORD,
  version: '2016-05-19',
  url: 'https://gateway.watsonplatform.net/tone-analyzer/api/'
});

module.exports = function(WatsonTone) {

    WatsonTone.tone = function(msg, cb) {

        if (msg.tone_input && !msg.content_type) {
            msg.content_type = 'application/json'
        }

        toneAnalyzer.tone(msg, (err, resp) => {
            if (err) return cb(err)

            cb(null, resp)
        })

    }

    WatsonTone.toneChat = function(toneChatParams, cb) {

        toneAnalyzer.toneChat(toneChatParams, (err, resp) => {
            if (err) return cb(err)

            cb(null, resp)
        })
        
    }

}
