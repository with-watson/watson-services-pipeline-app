'use strict'

const PersonalityInsightsV3 = require('watson-developer-cloud/personality-insights/v3')

const personalityInsights = new PersonalityInsightsV3({
    version: '2016-10-19',
    username: process.env.WATSON_PERSONALITY_USERNAME,
    password: process.env.WATSON_PERSONALITY_PASSWORD,
    url: process.env.WATSON_PERSONALITY_URL
})

module.exports = function (WatsonPersonality) {

    WatsonPersonality.getProfile = function (msg, cb) {
        personalityInsights.profile(msg, function (err, resp) {
            if (err) return cb(err)
            cb(null, resp)
        })
    }

}
