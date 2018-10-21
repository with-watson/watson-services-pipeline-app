'use strict'

const NaturalLanguageClassifierV1 = require('watson-developer-cloud/natural-language-classifier/v1')

const classifier = new NaturalLanguageClassifierV1({
    username: process.env.NLC_USERNAME,
    password: process.env.NLC_PASSWORD,
    url: 'https://gateway.watsonplatform.net/natural-language-classifier/api/'
})

module.exports = function(WatsonNlc) {

    WatsonNlc.classify = function(msg, cb) {

        classifier.classify(msg, (err, resp) => {
            if (err) return cb(err)
            cb(null, resp)
        })
    }

}
