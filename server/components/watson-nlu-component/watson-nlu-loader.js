'use strict'

module.exports = async function (app, options) {

    if (!app.models['WatsonNlu']) await defineWatsonNlu()

    function defineWatsonNlu() {
        return new Promise((resolve, reject) => {
            // Create a Model Constructor using the json definition
            const WatsonNluConstructor = app.registry.createModel(require('./models/watson-nlu.json'))
            // Create a Model from the Model Constructor
            const watsonNlu = app.model(WatsonNluConstructor, { dataSource: null, public: true })
            // Instantiate the Remote Model implementation
            const watsonNluRemote = require('./models/watson-nlu')(watsonNlu)
    
            resolve(watsonNluRemote)
        })
    }
}