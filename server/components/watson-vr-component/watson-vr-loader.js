'use strict'

module.exports = async function (app, options) {

    if (!app.models['WatsonVR']) await defineWatsonVR()

    function defineWatsonVR() {
        return new Promise((resolve, reject) => {
            // Create a Model Constructor using the json definition
            const WatsonVRConstructor = app.registry.createModel(require('./models/watson-vr.json'))
            // Create a Model from the Model Constructor
            const watsonVR = app.model(WatsonVRConstructor, { dataSource: null, public: true })
            // Instantiate the Remote Model implementation
            const watsonVRRemote = require('./models/watson-vr')(watsonVR)
    
            resolve(watsonVRRemote)
        })
    }
}