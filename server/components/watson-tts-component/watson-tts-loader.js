'use strict'

module.exports = async function (app, options) {

    if (!app.models['WatsonTTS']) await defineWatsonTTS()

    function defineWatsonTTS() {
        return new Promise((resolve, reject) => {
            // Create a Model Constructor using the json definition
            const WatsonTTSConstructor = app.registry.createModel(require('./models/watson-tts.json'))
            // Create a Model from the Model Constructor
            const watsonTTS = app.model(WatsonTTSConstructor, { dataSource: null, public: true })
            // Instantiate the Remote Model implementation
            const watsonTTSRemote = require('./models/watson-tts')(watsonTTS)
    
            resolve(watsonTTSRemote)
        })
    }
}