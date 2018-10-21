'use strict'

module.exports = async function (app, options) {

    if (!app.models['TestApi']) await defineTestApi()

    function defineTestApi() {
        return new Promise((resolve, reject) => {
            // Create a Model Constructor using the json definition
            const TestApiConstructor = app.registry.createModel(require('./models/test-api.json'))
            // Create a Model from the Model Constructor
            const testApi = app.model(TestApiConstructor, { dataSource: null, public: true })
            // Instantiate the Remote Model implementation
            const testApiRemote = require('./models/test-api')(testApi)
    
            resolve(testApiRemote)
        })
    }
}