'use strict'

const LOG = require('../../../utils/logger.js')

const STATE_CREATE = 'create'
const STATE_INITIALIZE = 'initialize'
const STATE_ACTIVE = 'active'
const STATE_COMPLETE = 'complete'
const STATE_PAUSE = 'pause'
const STATE_ERROR = 'error'

const MAX_POLL = 10

var PipelineImpl = function (_app, _definition) {
    
    this.app = _app
    this.definition = _definition
    this.instanceStore = this.app.models['PipelineInst']    

    this.mapper = this.app.models[_definition.mapper]

    this.done = false  // Is the pipeline instance done
    this.waitingOn = null // Waiting on a function call
    this.busy = false // Busy executing a function call
    
    this.context = {
        pipelineName: _definition.name,
        bucket: this.definition.bucket,
        state: STATE_CREATE,
        created: new Date(),
        active: {},
        history: []
    }
    
    LOG.debug('%s Pipeline runtime created for definition.', _definition.name)

    this.genericStepCallbackHandler = async (err, act) => {
        if (err) {
            await this.error(err)
            return LOG.error('Generic Step Callback Error: %s', err)
        }
        LOG.debug('%s %s Pipeline Instance Step Execution Callback: %o', this.context.pipelineName, this.context.id, act)
    }    

}

PipelineImpl.prototype.initialize = function (existing) {
    return new Promise( async (resolve, reject) => {
        try {
            if (existing) {                
                // Use the existing context to initialize this pipeline instance
                this.context = existing
                this.context.active = {}
                this.context.active.idx = -1
    
                LOG.debug('%s %s Pipeline is initialized from existing instance.', this.context.pipelineName, existing.id)

                resolve(this.acknowledge())
    
            } else {
                this.context.state = STATE_INITIALIZE
                this.context.active = {}
                this.context.active.idx = -1
        
                let created = await this.createInstance()
    
                this.context.id = created.id
    
                LOG.debug('%s %s Pipeline instance is initialized.', this.context.pipelineName, created.id)

                resolve(this.acknowledge())
            }
        } catch (err) {
            LOG.error('%s %s PipelineImpl.initialize > %s', this.context.pipelineName, this.context.id, err)
            await this.error(err)
            reject(err)
        }
    })
}

PipelineImpl.prototype.status = function () {
    return new Promise((resolve, reject) => {
        let status = {
            id: this.context.id,
            started: this.context.created,
            ended: this.context.ended,
            state: this.context.state,
            history: this.context.history
        }
        resolve(status)
    })
}

PipelineImpl.prototype.outcome = function () {
    return new Promise((resolve, reject) => {
        if (this.mapper['postPipeline']) {
            let results = this.mapper['postPipeline'].call(null, this.context)
            resolve(results)
        } else {
            resolve(this.context)
        }
    })
}

// Inbound
PipelineImpl.prototype.trigger = function (triggerData) {
    return new Promise( async (resolve, reject) => {
        try {
            this.context.active = this.definition.steps[0]
            this.context.active.started = new Date()
            this.context.active.state = STATE_ACTIVE
            // Set the index to the first step in the pipeline to not break next processing.
            this.context.active.idx = 0
    
            this.context.state = STATE_ACTIVE
    
            resolve(this.acknowledge())
            
            // Now call the postMapping function
            this.postProcessing(triggerData)
    
            LOG.debug('%s %s Pipeline instance was triggered.',this.context.pipelineName, this.context.id)
            
            let keepgoing = await this.toNext()
            // If it's the end of the pipeline the complete the pipeline
            if (!keepgoing) {
                return resolve(this.acknowledge())        
            }

            // execute the next step in the pipeline
            this.step()
    
        } catch (err) {
            LOG.error('PipelineImpl.trigger > %s', err)
            await this.error(err)
            reject(err)            
        }
    })
}

// Inbound
PipelineImpl.prototype.notify = function (results) {
    return new Promise( async (resolve, reject) => {
        try {
            
            // Now call the postMapping function
            this.postProcessing(results)
            
            // check if this is the step we're be waiting on to be notified for
            if (this.waitingOn && this.waitingOn === this.context.active.key) {
                this.waitingOn = null
            } else {
                return reject('Unexpected notification received by Pipeline instance, pipeline is waiting on %s', this.waitingOn)
            }

            LOG.debug('%s %s Pipeline instance was notified', this.context.pipelineName, this.context.id)
            
            // Move to pointer to the next step in the pipeline
            let keepgoing = await this.toNext()
            // If it's the end of the pipeline the complete the pipeline
            if (!keepgoing) {
                return resolve(this.acknowledge())        
            }
            // execute the next step in the pipeline
            this.step()
    
            resolve(this.acknowledge())        
    
        } catch (err) {
            LOG.error('PipelineImpl.notify > %s', err)
            await this.error(err)
            reject(err)            
        }

    })
}

// Inbound
PipelineImpl.prototype.resume = function (resumeData) {
    return new Promise( async (resolve, reject) => {
        try {
            if (this.context.state === STATE_ACTIVE) {
                return reject('Attempting to resume a pipeline isntance that is in active state')
            }
            // if from is specified, then set the from step as the active step.
            if (resumeData.from) {
                let s = resumeData.from.split('.')
                if (s.length != 3) {
                    return reject('Resume from value must be in format [model].[method].[index]')
                }
                let idx = Number.parseInt(s[2])
                this.context.active = this.definition.steps[idx]
                this.context.active.idx = idx
                this.context.active.started = new Date()
                this.context.active.state = STATE_ACTIVE
                this.context.active.key = this.context.active.model + '.' + this.context.active.method + '.' + this.context.active.idx    
                LOG.debug('%s %s Pipeline instance resume setting the active step to %s', this.context.pipelineName, this.context.id, this.context.active)
                if (this.context.active.model != s[0] || this.context.active.method != s[1]) {
                    return reject('Result from value mismatch with defined step.')
                }
                this.context.history = this.context.history.slice(0, idx - 1)
            }

            if (this.context.paused) this.context['paused'] = null

            this.context.state = STATE_ACTIVE

            this.step()

            resolve(this.acknowledge())
        } catch (err) {
            LOG.error('PipelineImpl.resume > %s', err)
            await this.error(err)
            reject(err)
        }

    })
}

// Outbound
PipelineImpl.prototype.step = function () {
    try {
        let pollCnt = 0
        // Wait on the previous step to complete before executing the next step.
        this.hold = setInterval( async () => {
            if (!this.waitingOn && !this.busy) {

                this.busy = true

                // Save the instance to the datastore
                await this.updateInstance()

                LOG.debug('Pipeline instance ' + this.context.id + ' is executing step ' + this.context.active.model + '.' + this.context.active.method)
                
                // Add this call to the execution queue
                this.waitingOn = this.context.active.key
                try {
                    // Build the request arguments for the call
                    let args = this.preProcessing(this.context)
                    // This function is the callback from the function that is being executed as the step
                    args.push(this.genericStepCallbackHandler)
                    // Clear the interval we are in
                    clearInterval(this.hold)
                    // Set the busy flag to false
                    this.busy = false
                    // Execute the step function
                    this.app.models[this.context.active.model][this.context.active.method].apply(null, args)
                } catch (err) {
                    LOG.error('PipelineImpl.step exection error: %s', err)
                    this.error(err)
                }
            } else {
                pollCnt++
                if (pollCnt > MAX_POLL) {
                    clearInterval(this.hold)
                    this.error('Maxmum poll count reached, terminating the pipeline instance.')
                }
                LOG.info('%s %s Waiting on notification before executing next step: %s %s', this.context.pipelineName, this.context.id, this.waitingOn, this.busy)
            }
        }, 1000)

    } catch (err) {
        LOG.error('PipelineImpl.step > ', err)
        this.error(err)
    }
}

PipelineImpl.prototype.toNext = function () {
    return new Promise(async (resolve, reject) => {
        try {
            // If we are inside a forloop step then check if we should exit or continue
            if (this.context.active.until) {
                this.context.active.forloop_index++
                // execute the until function on the mapper
                let done = this.mapper[this.context.active.until](this.context, this.context.active.forloop_index)
                LOG.debug('%s %s For-loop until function executed with outcome of %s', this.context.pipelineName, this.context.id, done)
                if (!done) {
                    return resolve(true)
                }
            }
            let idx = this.context.active.idx
            LOG.debug('%s %s Pipeline instance toNext Current active index is %d', this.context.pipelineName, this.context.id, idx)
            // Before moving to the next step, wrap up the active step
            this.context.active.ended = new Date()
            this.context.active.state = STATE_COMPLETE
            // Move to the next step in the pipeline
            idx++
            // If the current step was the last step
            if (!this.definition.steps[idx]) {
                LOG.warn('%s %s Pipeline instance has ended.  Completion process is being initiated.', this.context.pipelineName, this.context.id)
                this.done = true
                // complete the pipeline
                await this.complete()

                return resolve(false)
            }
            // Save it in the history
            this.context.history.push(JSON.parse(JSON.stringify(this.context.active)))
            // Select the next step in the pipeline
            this.context.active = this.definition.steps[idx]
            this.context.active.idx = idx
            this.context.active.started = new Date()
            this.context.active.state = STATE_ACTIVE
            this.context.active.key = this.context.active.model + '.' + this.context.active.method + '.' + this.context.active.idx
            LOG.debug('%s %s Pipeline instance moves to the next step in the pipeline definition %s', this.context.pipelineName, this.context.id, this.context.active.key)
            // If the new step is a forloop step, then initialize the forloop
            if (this.context.active.until) {
                LOG.warn('%s %s For-loop step detected.', this.context.pipelineName, this.context.id)
                // create the internal index
                this.context.active.forloop_index = 0                    
            }            
            // If this step is an await step, then pause the pipeline until another trigger is received.
            if (this.context.active.await) {
                await this.pause()
                if (this.hold) {
                    clearInterval(this.hold)
                    this.hold = null
                }
                return resolve(false)
            }
            resolve(true)
            
        } catch (err) {
            LOG.error('PipelineImpl.toNext > %s', err)
            await this.error(err)
            reject(err)
        }
    })
}

PipelineImpl.prototype.error = function (err) {
    return new Promise( async (resolve, reject) => {
        try {
            LOG.error('%s %s Pipeline instance error: %s', this.context.pipelineName, this.context.id, err)

            if (this.hold) clearInterval(this.hold)

            this.done = true
            this.context.active.state = STATE_ERROR
            this.context.active.error = err
            this.context.active.ended = new Date()
            // Save the current activity to the history list
            this.context.history.push(JSON.parse(JSON.stringify(this.context.active)))

            delete this.context['active']

            // Finish up the pipeline data
            this.context.state = STATE_ERROR
            this.context.ended = Date()
                            
            await this.updateInstance()
    
            resolve()    
        } catch (err) {
            LOG.error('PipelineImpl.complete > %s', err)
            reject(err)
        }
    })
}

PipelineImpl.prototype.complete = function () {
    return new Promise( async (resolve, reject) => {
        try {
            LOG.debug('%s %s Pipeline instance completed.', this.context.pipelineName, this.context.id)
            // Stop waiting on a notification
            if (this.hold) {
                clearInterval(this.hold)
                this.hold = null
            }            
            this.done = true
            this.context.active.state = STATE_COMPLETE
            this.context.active.ended = new Date()
            // Save the current activity to the history list
            this.context.history.push(JSON.parse(JSON.stringify(this.context.active)))

            this.context.active = null

            // Finish up the pipeline data
            this.context.state = STATE_COMPLETE
            this.context.ended = new Date()
                            
            await this.updateInstance()
    
            resolve()    
        } catch (err) {
            LOG.error('PipelineImpl.complete > %s', err)
            await this.error(err)
            reject(err)
        }
    })
}

PipelineImpl.prototype.pause = function () {
    return new Promise( async (resolve, reject) => {
        try {
            LOG.debug('%s %s Pipeline instance  paused.', this.context.pipelineName, this.context.id)

            this.context.active.state = STATE_PAUSE
            // Finish up the pipeline data
            this.context.state = STATE_PAUSE
            this.context.paused = Date()
                            
            await this.updateInstance()
    
            resolve()    
        } catch (err) {
            LOG.error('PipelineImpl.pause > %s', err)
            await this.error(err)
            reject(err)
        }
    })
}

PipelineImpl.prototype.postProcessing = function (results) {
    // Now call the postMapping function
    if (this.mapper) {
        // Build the post mapping function name
        let tmpModel = this.context.active.model.replace(/\b\w/g, function(l){ return l.toUpperCase() })
        let tmpMethod = this.context.active.method.replace(/\b\w/g, function(l){ return l.toUpperCase() })
        let postMappingFunctionName = 'post' + tmpModel + tmpMethod

        if (this.mapper[postMappingFunctionName]) {
            this.context = this.mapper[postMappingFunctionName].call(null, results, this.context)
            if (!this.context.id || !this.context.active) {
                throw Error('Post processing function broke the context, please verify the function is returning the updated context.')
            }
        }
    }
}

PipelineImpl.prototype.preProcessing = function () {

    let tmpModel = this.context.active.model.replace(/\b\w/g, function(l){ return l.toUpperCase() })
    let tmpMethod = this.context.active.method.replace(/\b\w/g, function(l){ return l.toUpperCase() })

    let preMappingFunctionName = tmpModel + tmpMethod
    if (!this.mapper[preMappingFunctionName]) {
        throw Error('Mapper function does not resolve to a function on the mapper script: %s' + preMappingFunctionName)
    }

    // Execute the Request mapping function
    let args = []
    try {
        args = this.mapper[preMappingFunctionName].call(null, this.context)
    } catch (err) {
        LOG.error(err)
        throw Error(err)
    }
    
    
    return args
}

PipelineImpl.prototype.createInstance = function () {
    return new Promise((resolve, reject) => {
        try {
            this.instanceStore.create(this.context, (err, created) => {
                if (err) return reject(err)
    
                resolve(created)
            })    
        } catch (err) {
            LOG.error('PipelineImpl.createInstance > %s', err)
            reject(err)
        }
        
    })
}

PipelineImpl.prototype.updateInstance = function () {
    return new Promise((resolve, reject) => {
        try {
            if (!this.context.id) return reject('Context id value missing or not yet set.')
            this.instanceStore.update(this.context, (err, updated) => {
                if (err) return reject(err)
                this.context._rev = updated._rev
                resolve(updated)
            })    
        } catch (err) {
            LOG.error('PipelineImpl.updateInstance > %s', err)
            reject(err)
        }
    })
}

PipelineImpl.prototype.acknowledge = function () {
    return { 'status': 'ok', 'id':  this.context.id }
}

module.exports = PipelineImpl