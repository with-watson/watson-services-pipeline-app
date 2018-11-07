'use strict'

const EventEmitter = require('events').EventEmitter;
var util = require('util')

const LOG = require('../../utils/logger.js')

const PipelineImpl = require('./lib/pipeline-impl')
const cosUtils = require('./lib/utils/cos-utils')

var PipelineController = function () {
    
    LOG.debug('Creating a new Pipeline Controller Instance...')
    
}

util.inherits(PipelineController, EventEmitter);

PipelineController.prototype.initialize = function (_app) {
    return new Promise(async (resolve, reject) => {

        this.app = _app

        this.instanceStore = this.app.models['PipelineInst']
        if (!this.instanceStore) throw Error('No Pipeline instance store defined.')

        this.definitionCache = {}
        this.instanceCache = {}
        
        LOG.debug('Pipeline Controller initialized.')

        resolve()
    })
}

PipelineController.prototype.register = function (definition) {
    return new Promise( async (resolve, reject) => {
        let err = await validateDefinition(this.app, definition)
        if (err) throw Error(err)

        // Check if the bucket is created for COS otherwise create it
        cosUtils.bucketExist(definition.bucket, true, (err) => {
            if (err) throw Error(err)

            this.definitionCache[definition.name] = definition

            LOG.debug('%s Pipeline Controller registed a definition.', definition.name)

            resolve()
        })
    })
}

// Inbound
PipelineController.prototype.trigger = function (triggerData) {
    return new Promise( async (resolve, reject) => {
        try {
            if (!this.definitionCache[triggerData.pipelineName]) {
                reject('Pipeline name does not resolve to a pipeline definition.')
            }
            // Create a new instance of the pipeline
            let pipelineInstance = new PipelineImpl(this.app, this.definitionCache[triggerData.pipelineName])
            let act = await pipelineInstance.initialize()

            this.instanceCache[act.id] = pipelineInstance

            // Trigger the pipeline to notify anyone that is listening
            act = await pipelineInstance.trigger(triggerData)

            this.emit('trigger', pipelineInstance.context)

            LOG.debug('%s %s Pipeline Controller was triggered and produced instance.', triggerData.pipelineName, act.id)

            resolve(act)

            // If the pipeline is done, then complete the instance
            if (pipelineInstance.done) {
                await this.complete(act.id)
                LOG.debug('%s %s Pipeline Controller completes pipeline in trigger function for instance.', triggerData.pipelineName, act.id)
            }

        } catch (err) {
            reject(err)
        }
    })
}

// Inbound
PipelineController.prototype.notify = function (id, results) {
    
    return new Promise( async (resolve, reject) => {

        try {
            let pipelineInstance = await this.retrieveInstance(id)
            if (!pipelineInstance) {
                return reject('Pipeline instance not found.')
            }

            this.emit('notify', pipelineInstance.context)
                        
            // Call the active pipeline instance
            let act = await pipelineInstance.notify(results)

            // Respond back to step that is notifying the pipeline that the notification is received.
            resolve(act)

            LOG.debug('%s %s Pipeline Controller notified instance.', pipelineInstance.context.pipelineName, pipelineInstance.context.id)

            if (pipelineInstance.done) {
                await this.complete(act.id)
                LOG.debug('%s %s Pipeline Controller completes pipeline in notification function for instance.', pipelineInstance.context.pipelineName, pipelineInstance.context.id)
            }

            
        } catch (err) {
            LOG.error('PipelineController.notify > ', err)
            this.emit('error', [err, this.context])
            reject(err)
        }
    })

}

// Inbound
PipelineController.prototype.resume = function (resumeData) {
    return new Promise( async (resolve, reject) => {
        try { 
            delete this.instanceCache[resumeData.id]
            
            let pipelineInstance = await this.retrieveInstance(resumeData.id)

            this.emit('resume', pipelineInstance.context)
            
            // Save this pipeline instance as an active pipeline
            this.instanceCache[resumeData.id] = pipelineInstance
    
            // Trigger the pipeline to notify anyone that is listening
            let act = await pipelineInstance.resume(resumeData)

            resolve(act)    
    
            if (pipelineInstance.done) {
                await this.complete(act.id)
                LOG.debug('%s %s Pipeline Controller completes pipeline in resume function for instance.', pipelineInstance.context.pipelineName, pipelineInstance.context.id)
            }

            LOG.debug('%s %s Pipeline Controller resumed instance.', pipelineInstance.context.pipelineName, pipelineInstance.context.id)
            
        } catch (err) {
            LOG.error('PipelineController.resume > ', err)
            this.emit('error', [err, this.context])
            reject(err)
        }
    })
}

PipelineController.prototype.status = function (id) {
    return new Promise( async (resolve, reject) => {
        try {
            let pipelineInstance = await this.retrieveInstance(id)
            // Build the status response
            resolve(pipelineInstance.status())
        } catch (err) {
            LOG.error('PipelineController.status > ', err)
            reject(err)
        }
    })
}

PipelineController.prototype.outcome = function (id) {
    return new Promise( async (resolve, reject) => {
        try {
            let pipelineInstance = await this.retrieveInstance(id)
            // Build the status response
            resolve(pipelineInstance.outcome())
        } catch (err) {
            LOG.error('PipelineController.outcome > ', err)
            reject(err)
        }
    })
}

// End
PipelineController.prototype.complete = function (id) {
    return new Promise( async (resolve, reject) => {
        let pipelineInstance = await this.retrieveInstance(id)
        
        this.emit('complete', pipelineInstance.context)

        delete this.instanceCache[id]

        resolve()
    })    
}

PipelineController.prototype.retrieveInstance = function (id) {
    return new Promise((resolve, reject) => {
        try {
            // Check the cache and if return it if found
            if (this.instanceCache[id]) {
                return resolve(this.instanceCache[id])
            }
            LOG.warn('%s Pipeline instance is being retrieved from the instance datasource.', id )
            // Otherwise, check the database for the instance
            this.instanceStore.findById(id, async (err, existing) => {
                if (err) {
                    LOG.error(err)
                    return resolve()
                }
                if (!existing) {
                    LOG.error('Pipeline instance not found.')
                    return resolve()
                }

                let pipelineInstance = new PipelineImpl(this.app, this.definitionCache[existing.pipelineName])
                let act = await pipelineInstance.initialize(existing)
                this.instanceCache[pipelineInstance.id] = pipelineInstance
                resolve(pipelineInstance)
            })
        } catch (err) {
            LOG.error('PipelineController.retrieveInstance > ', err)
            this.emit('error', [err, this.context])
            resolve()         
        }
    })
}

PipelineController.prototype.getBucketForInstance = function (id) {
    return new Promise( async (resolve, reject) => {
        let pipelineInstance = await this.retrieveInstance(id)

        resolve(pipelineInstance.definition.bucket)
    })
}

PipelineController.prototype.getBucket = function (pipelineName) {
    return this.definitionCache[pipelineName].bucket
}

function validateDefinition (_app, definition) {
    if (!definition.name) return 'Pipeline Definition name missing.'
    if (!definition.bucket) return 'Cloud Object Storage container/bucket name missing.'
    if (!definition.steps || definition.steps.length === 0) return 'Steps are required for a pipeline to function.'

    if (!definition.mapper) return 'Pipeline mapper models is required.'
    if (!_app.models[definition.mapper]) return 'Pipeline mapper model is not defined.'

    let i = 1
    for (let step of definition.steps) {
        if (!step.model) return 'Step ' + i + 'requires a model name.'
        if (!step.method) return 'Step ' + i + 'requires a method/function name.'

        if (!_app.models[step.model]) return 'Step ' + i + ' model does not exist.'
        if (!_app.models[step.model][step.method]) return 'Step ' + i + ' method/function does not existing on model script.'
        i++
    }
    LOG.debug('Definition ' + definition.name + ' validated successfully...')
}

module.exports = new PipelineController()