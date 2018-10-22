'use strict'

const LOG = require('../../utils/logger.js')
const PipelineController = require('./pipeline-controller')

module.exports = async function (app, options) {
    // Validate that the data connections are defined.
    if (!app.models[options.componentStorageModel]) {
        throw Error('Component Storage Model is not defined: ' + options.componentStorageModel)
    }
    if (!app.dataSources[options.instanceDataSource]) {
        throw Error('Instance Datasource is not defined: ' + options.instanceDataSource)
    }
    // Create all the Pipeline Models
    if (!app.models['Pipeline']) await definePipelineApi()
    if (!app.models['PipelineInst']) await definePipelineInstApi()

    await PipelineController.initialize(app)
    
    // Run through the passed in Pipeline Definitions and register them with the controller
    for (let definition of options.pipelines) {
        PipelineController.register(definition, (err) => {
            if (err) throw Error(err)
            LOG.info('Registered Pipeline Definition for Pipeline ' + definition.name)
        })
    }

    function definePipelineApi() {
        return new Promise((resolve, reject) => {
            // Create a Model Constructor using the json definition
            const PipelineConstructor = app.registry.createModel(require('./lib/models/pipeline.json'))
            // Create a Model from the Model Constructor
            const pipeline = app.model(PipelineConstructor, { dataSource: null, public: true })
            // Instantiate the Remote Model implementation
            const pipelineRemote = require('./lib/models/pipeline')(pipeline)
    
            resolve(pipelineRemote)
        })
    }
    
    function definePipelineInstApi() {
        return new Promise((resolve, reject) => {
            // Define the Pipeline Definition Data Model
            const PipelineInstConstructor = app.registry.createModel(require('./lib/models/pipeline-inst.json'))
            
            const pipelineInst = app.model(PipelineInstConstructor, { dataSource: options.instanceDataSource, public: false })
    
            const pipelineInstRemote = require('./lib/models/pipeline-inst')(pipelineInst)  
            
            resolve(pipelineInstRemote)
        })
    }

}