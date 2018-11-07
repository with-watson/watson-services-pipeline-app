'use strict'

const LanguageTranslatorV3 = require('watson-developer-cloud/language-translator/v3');

var languageTranslator = new LanguageTranslatorV3({
    iam_apikey: process.env.TRANSLATION_APIKEY,
    username: process.env.TRANSLATION_USERNAME,
    password: process.env.TRANSLATION_PASSWORD,
    url: process.env.TRANSLATION_URL,
    version: '2018-05-01'
})

module.exports = function(WatsonTranslation) {

    WatsonTranslation.identifyLanguage = function (text, cb) {
        var p = {
            text: text
        }
        languageTranslator.identify(p, (err, source) => {
            if (err) return cb(err)
            cb(null, source)
        })   
    }

    WatsonTranslation.translateText = function (text, cb) {
        if (text.trim().length === 0) {
            return resolve(text)
        }
        var p = {
            text: text,
            source: params.sourceLanguage,
            target: params.targetLanguage
        }
        languageTranslator.translate(p, (err, response) => {
            if (err) return cb(err)
            if (response && response.translations && response.translations.length > 0) {
                cb(null, response.translations[0].translation)
            } else {
                cb(null, text)
            }
        })
    }
}
