'use strict'

module.exports = async function (app, options) {

    if (!app.models['WatsonTranslation']) await defineWatsonTranslation()

    function defineWatsonTranslation() {
        return new Promise((resolve, reject) => {
            // Create a Model Constructor using the json definition
            const WatsonTranslationConstructor = app.registry.createModel(require('./models/watson-translation.json'))
            // Create a Model from the Model Constructor
            const watsonTranslation = app.model(WatsonTranslationConstructor, { dataSource: null, public: true })
            // Instantiate the Remote Model implementation
            const watsonTranslationRemote = require('./models/watson-translation')(watsonTranslation)
    
            resolve(watsonTranslationRemote)
        })
    }
}