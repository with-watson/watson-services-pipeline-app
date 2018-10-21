'use strict'

module.exports = async function (app, options) {

    if (!app.models['WatsonPersonality']) await defineWatsonPersonality()

    function defineWatsonPersonality() {
        return new Promise((resolve, reject) => {
            // Create a Model Constructor using the json definition
            const WatsonPersonalityConstructor = app.registry.createModel(require('./models/watson-personality.json'))
            // Create a Model from the Model Constructor
            const watsonPersonality = app.model(WatsonPersonalityConstructor, { dataSource: null, public: true })
            // Instantiate the Remote Model implementation
            const watsonPersonalityRemote = require('./models/watson-personality')(watsonPersonality)
    
            resolve(watsonPersonalityRemote)
        })
    }
}