'use strict'

module.exports = async function (app, options) {

    if (!app.models['WatsonNlc']) await defineWatsonNlc()

    function defineWatsonNlc() {
        return new Promise((resolve, reject) => {
            // Create a Model Constructor using the json definition
            const WatsonNlcConstructor = app.registry.createModel(require('./models/watson-nlc.json'))
            // Create a Model from the Model Constructor
            const watsonNlc = app.model(WatsonNlcConstructor, { dataSource: null, public: true })
            // Instantiate the Remote Model implementation
            const watsonNlcRemote = require('./models/watson-nlc')(watsonNlc)
    
            resolve(watsonNlcRemote)
        })
    }
}