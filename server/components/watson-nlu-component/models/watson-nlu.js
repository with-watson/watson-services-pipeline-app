'use strict'

const NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1');

const nlu = new NaturalLanguageUnderstandingV1({
    username: process.env.NLU_USERNAME,
    password: process.env.NLU_PASSWORD,
    version: '2018-04-05',
    url: 'https://gateway.watsonplatform.net/natural-language-understanding/api/'
})

module.exports = function(WatsonNlu) {

    WatsonNlu.analyze = function(msg, cb) {

        if (!msg.features || Object.keys(msg.features).length === 0) {
            msg.features = {}
            msg.features.keywords = {}
        }
                
        nlu.analyze(msg, (err, resp) => {
            if (err) return cb(err)

            cb(null, resp)
        })
    }

}
