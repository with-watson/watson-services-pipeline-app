'use strict'

const LOG = require('../../utils/logger.js')
const PipelineController = require('./pipeline-controller')

module.exports = async function (app, options) {
    // Validate that the data connections are defined.
    if (!options.componentStorageModel || !app.models[options.componentStorageModel]) {
        LOG.warn('PipelineComponent > Component Storage Model is not defined.  This means no Cloud Object Storage access will be available.')
    }
    // The Instance Datasource should be defined in the datasources.json file as a Loopback supported DS.
    // It will be connected to the PipelineInst model and used for persisting the Pipeline Instance data to.
    if (!app.dataSources[options.instanceDataSource]) {
        throw Error('Instance Datasource is not defined: ' + options.instanceDataSource)
    }
    // Create all the Pipeline Models
    if (!app.models['Pipeline']) await definePipelineApi()
    if (!app.models['PipelineManagement']) await definePipelineManagementApi()
    if (!app.models['PipelineInst']) await definePipelineInstApi()

    // Initialize the Pipeline Controller
    await PipelineController.initialize(app)
    
    // Run through the passed in Pipeline Definitions and register them with the controller
    for (let definition of options.pipelines) {
        PipelineController.register(definition, (err) => {
            if (err) throw Error(err)
            LOG.info('PipelineComponent > Registered Pipeline Definition for Pipeline ' + definition.name)
        }).catch(err => {
            LOG.error('Error Registering Pipeline: ' + definition.name)
            LOG.error(err)
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
    
            LOG.debug('PipelineComponent > Pipeline REST Api Configured.')

            resolve(pipelineRemote)
        })
    }
    
    function definePipelineManagementApi() {
        return new Promise((resolve, reject) => {
            // Create a Model Constructor using the json definition
            const PipelineManagementConstructor = app.registry.createModel(require('./lib/models/pipeline-management.json'))
            // Create a Model from the Model Constructor
            const pipelineManagement = app.model(PipelineManagementConstructor, { dataSource: null, public: true })
            // Instantiate the Remote Model implementation
            const pipelineManagementRemote = require('./lib/models/pipeline-management')(pipelineManagement)
    
            LOG.debug('PipelineComponent > Pipeline Management REST Api Configured.')

            resolve(pipelineManagementRemote)
        })
    }

    function definePipelineInstApi() {
        return new Promise((resolve, reject) => {
            // Define the Pipeline Definition Data Model
            const PipelineInstConstructor = app.registry.createModel(require('./lib/models/pipeline-inst.json'))
            
            const pipelineInst = app.model(PipelineInstConstructor, { dataSource: options.instanceDataSource, public: false })
    
            const pipelineInstRemote = require('./lib/models/pipeline-inst')(pipelineInst)  
            
            LOG.debug('PipelineComponent > PipelineInst Persistant Model Configured.')

            resolve(pipelineInstRemote)
        })
    }

}