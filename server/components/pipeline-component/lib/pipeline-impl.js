'use strict'

const LOG = require('../../../utils/logger.js')

const stringify = require('json-stringify-safe')

const STATE_CREATED = 'created'
const STATE_INITIALIZED = 'initialized'
const STATE_ACTIVE = 'active'
const STATE_COMPLETED = 'completed'
const STATE_PAUSED = 'paused'
const STATE_FAILED = 'failed'

const MAX_POLL = 10

var PipelineImpl = function (_app, _definition) {
    
    LOG.silly('PipelineImpl > Pipeline Instance created for definition: %s', _definition.name)

    this.app = _app
    this.definition = _definition
    this.instanceStore = this.app.models['PipelineInst']    

    this.mapper = this.app.models[_definition.mapper]

    this.done = false  // Is the pipeline instance done
    this.waitingOn = null // Waiting on a function call
    this.busy = false // Busy executing a function call
    
    let now = new Date()

    this.context = {
        pipelineName: _definition.name,
        bucket: this.definition.bucket,
        state: STATE_CREATED,
        created: now.toISOString(),
        active: {},
        history: []
    }    

    this.genericStepCallbackHandler = async (err, act) => {
        if (err) {
            await this.error(err)
            return LOG.error('PipelineImpl > Generic Step Callback Error: %s', err)
        }
        
        LOG.debug('PipelineImpl > %s %s Pipeline Instance Step Execution Callback received.', this.context.pipelineName, this.context.id)
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
    
                LOG.debug('PipelineImpl > %s %s Pipeline is initialized from existing instance.', this.context.pipelineName, existing.id)

                resolve(this.acknowledge())
    
            } else {
                this.context.state = STATE_INITIALIZED
                this.context.active = {}
                this.context.active.idx = -1
        
                let created = await this.createInstance()
    
                this.context.id = created.id
                this.context._rev = created._rev
    
                LOG.debug('PipelineImpl > %s %s Pipeline instance initialized.', this.context.pipelineName, created.id)

                resolve(this.acknowledge())
            }
        } catch (err) {
            await this.error(err)
            reject(err)
        }
    })
}

// Trigger this pipeline instance to start the executions of the defined steps.
PipelineImpl.prototype.trigger = function (triggerReq) {
    return new Promise( async (resolve, reject) => {
        try {
            // Map some of the trigger request data to the conext
            this.context.triggerType = triggerReq.triggerType
            this.context.triggerFile = triggerReq.fileName
            
            this.context.active = this.definition.steps[0]
            this.context.active.idx = 0
            this.context.active.key = this.context.active.model + '.' + this.context.active.method + '.' + this.context.active.idx
            
            let now = new Date()
            this.context.active.started = now.toISOString()

            this.context.active.state = STATE_ACTIVE
            // Set the index to the first step in the pipeline to not break next processing.
            this.context.active.idx = 0
    
            this.context.state = STATE_ACTIVE
    
            LOG.info('PipelineImpl > %s %s Pipeline instance was triggered.',this.context.pipelineName, this.context.id)
            
            // Now call the postMapping function
            await this.postProcessing(triggerReq)
    
            let keepgoing = await this.toNext().catch(err => {
                LOG.error(err)
                reject(err)
            })
            // If it's the end of the pipeline the complete the pipeline
            if (!keepgoing) {
                LOG.warn('PipelineImpl > The pipeline definition only contains a trigger?')
                return resolve(this.acknowledge())        
            }

            resolve(this.acknowledge())        

            // execute the next step in the pipeline
            this.step()
    
        } catch (err) {
            await this.error(err)
            reject(err)            
        }
    })
}

// Inbound
PipelineImpl.prototype.notify = function (results) {
    return new Promise( async (resolve, reject) => {
        try {
            
            LOG.verbose('PipelineImpl > %s %s Pipeline Instance Notified.', this.context.pipelineName, this.context.id)
            
            // Now call the postMapping function
            await this.postProcessing(results)
            
            // check if this is the step we're be waiting on to be notified for
            if (this.waitingOn && this.waitingOn === this.context.active.key) {
                this.waitingOn = null
            } else {
                return reject('PipelineImpl > Unexpected notification received by Pipeline instance, pipeline is waiting on ' + this.waitingOn)
            }
            
            // Move to pointer to the next step in the pipeline
            let keepgoing = await this.toNext().catch(err => {
                LOG.error(err)
                reject(err)
            })
            // If it's the end of the pipeline the complete the pipeline
            if (!keepgoing) {
                return resolve(this.acknowledge())        
            }
            // execute the next step in the pipeline
            this.step()
    
            resolve(this.acknowledge())        
    
        } catch (err) {
            await this.error(err)
            reject(err)            
        }
    })
}

// Inbound
PipelineImpl.prototype.resume = function (resumeData) {
    return new Promise( async (resolve, reject) => {
        try {
            LOG.verbose('PipelineImpl > %s %s Pipeline Instance Resumed.', this.context.pipelineName, this.context.id)

            if (this.context.state === STATE_ACTIVE) {
                return reject('PipelineImpl > Attempting to resume a pipeline instance that is in active state')
            }

            // if from is specified, then set the from step as the active step.
            if (resumeData.from) {
                let s = resumeData.from.split('.')
                if (s.length != 3) {
                    return reject('PipelineImpl > Resume from value must be in format [model].[method].[index]')
                }
                let idx = Number.parseInt(s[2])
                this.context.active = this.definition.steps[idx]
                this.context.active.idx = idx
                
                let now = new Date()
                this.context.active.started = now.toISOString()

                this.context.active.state = STATE_ACTIVE
                this.context.active.key = this.context.active.model + '.' + this.context.active.method + '.' + this.context.active.idx    

                LOG.debug('PipelineImpl > %s %s Pipeline instance resume setting the active step to %s', this.context.pipelineName, this.context.id, this.context.active)

                if (this.context.active.model != s[0] || this.context.active.method != s[1]) {
                    return reject('PipelineImpl > Result from value mismatch with defined step.')
                }
                this.context.history = this.context.history.slice(0, idx - 1)
            }

            if (this.context.paused) this.context['paused'] = null

            this.context.state = STATE_ACTIVE

            this.step()

            resolve(this.acknowledge())
        } catch (err) {
            await this.error(err)
            reject(err)
        }

    })
}

// Function that will move this pipeline instance to the next step in the pipeline definition and return whether it is the end or not.
PipelineImpl.prototype.toNext = function () {
    return new Promise(async (resolve, reject) => {
        try {
            // If we are inside a forloop step then check if we should exit or continue
            if (this.context.active.until) {
                this.context.active.forloop_index++
                // execute the until function on the mapper
                let done = this.mapper[this.context.active.until](this.context, this.context.active.forloop_index)
                LOG.verbose('PipelineImpl > %s %s For-loop until function executed with outcome of %s', this.context.pipelineName, this.context.id, done)
                if (!done) {
                    return resolve(true)
                }
            }
            let idx = this.context.active.idx

            LOG.debug('PipelineImpl > %s %s Pipeline instance toNext Current active index is %d', this.context.pipelineName, this.context.id, idx)

            // Before moving to the next step, wrap up the active step
            let now = new Date()
            this.context.active.ended = now.toISOString()
            this.context.active.duration = this.calculateStepDuration()
            this.context.active.state = STATE_COMPLETED

            // Save the currect active step into the history array
            let strObj = stringify(this.context.active)
            this.context.history.push(JSON.parse(strObj))
            
            LOG.verbose('PipelineImpl > %s %s Step %s completed.', this.context.pipelineName, this.context.id, this.context.active.key)

            // Move to the next step in the pipeline
            idx++
            // If the previous step was the last step, then complete the pipeline instance
            if (!this.definition.steps[idx]) {

                LOG.debug('PipelineImpl > %s %s Pipeline instance has ended.  Completion process is being initiated.', this.context.pipelineName, this.context.id)

                this.done = true
                // complete the pipeline
                await this.complete()

                // Don't keep going.
                return resolve(false)
            }

            // Make the next step the active step
            this.context.active = JSON.parse(JSON.stringify(this.definition.steps[idx]))
            this.context.active.idx = idx
            this.context.active.state = STATE_ACTIVE
            this.context.active.started = now.toISOString()

            // Generate a unique key for the step
            this.context.active.key = this.context.active.model + '.' + this.context.active.method + '.' + this.context.active.idx

            LOG.debug('PipelineImpl > %s %s Pipeline instance moves to step %s in the pipeline definition.', this.context.pipelineName, this.context.id, this.context.active.key)

            // If the new step is a forloop step, then initialize the forloop
            if (this.context.active.until) {
                LOG.warn('PipelineImpl > %s %s For-loop step detected.', this.context.pipelineName, this.context.id)
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
            await this.error(err)
            reject(err)
        }
    })
}

// Function that will execute the call to the step's model and function.
PipelineImpl.prototype.step = function () {
    try {
        let pollCnt = 0
        // Wait on the previous step to complete before executing the next step.
        this.hold = setInterval( async () => {
            if (!this.waitingOn && !this.busy) {

                this.busy = true

                // Save the instance to the datastore
                await this.updateInstance()

                LOG.verbose('PipelineImpl > %s %s Pipeline instance step %s execution. ', this.context.pipelineName, this.context.id, this.context.active.key)
                
                // Add this call to the execution queue
                this.waitingOn = this.context.active.key

                try {
                    // Build the request arguments for the call
                    let args = await this.preProcessing()
                    // This function is the callback from the function that is being executed as the step
                    args.push(this.genericStepCallbackHandler)
                    // Clear the interval we are in
                    clearInterval(this.hold)
                    // Set the busy flag to false
                    this.busy = false
                    // Execute the step function
                    this.app.models[this.context.active.model][this.context.active.method].apply(null, args)

                } catch (err) {
                    this.error(err)
                }
            } else {
                pollCnt++
                if (pollCnt > MAX_POLL) {
                    clearInterval(this.hold)
                    this.error('PipelineImpl > Maximum poll count reached, terminating the pipeline instance.')
                }
                LOG.verbose('PipelineImpl > %s %s Waiting on notification before executing next step: %s %s', this.context.pipelineName, this.context.id, this.waitingOn, this.busy)
            }
        }, 1000)

    } catch (err) {
        this.error(err)
        throw err
    }
}

PipelineImpl.prototype.error = function (err) {
    return new Promise( async (resolve, reject) => {
        try {
            LOG.error('PipelineImpl > %s %s Pipeline instance error: %o', this.context.pipelineName, this.context.id, err)

            if (this.hold) clearInterval(this.hold)

            this.done = true
            let now = new Date()

            if (this.context.active) {
                this.context.active.state = STATE_FAILED
                this.context.active.error = err
    
                this.context.active.ended = now.toISOString()    
                // Save the current activity to the history list
                let strObj = stringify(this.context.active)
                
                this.context.history.push(JSON.parse(strObj))

                delete this.context['active']
            }

            // Finish up the pipeline data
            this.context.state = STATE_FAILED
            this.context.failed_reason = err
            this.context.ended = now.toISOString()
                            
            await this.updateInstance()
    
            resolve()    
        } catch (err) {
            LOG.error('PipelineImpl > Error in error handler: %o', err)
            reject(err)
        }
    })
}

PipelineImpl.prototype.complete = function () {
    return new Promise( async (resolve, reject) => {
        try {
            
            // Stop waiting on a notification
            if (this.hold) {
                clearInterval(this.hold)
                this.hold = null
            }            
            this.done = true

            // Remove the active value from the context
            delete this.context.active

            // Finish up the pipeline data
            let now = new Date()
            this.context.state = STATE_COMPLETED
            this.context.ended = now.toISOString()

            this.context.duration = this.calculatePipelineDuration()

            await this.updateInstance()
    
            LOG.info('PipelineImpl > %s %s Pipeline instance completed.', this.context.pipelineName, this.context.id)

            resolve()    
        } catch (err) {
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

PipelineImpl.prototype.pause = function () {
    return new Promise( async (resolve, reject) => {
        try {
            LOG.verbose('PipelineImpl > %s %s Pipeline instance paused.', this.context.pipelineName, this.context.id)

            this.context.active.state = STATE_PAUSED
            // Finish up the pipeline data
            this.context.state = STATE_PAUSED
            this.context.paused = Date()
                            
            await this.updateInstance()
    
            resolve()    
        } catch (err) {
            await this.error(err)
            reject(err)
        }
    })
}

PipelineImpl.prototype.postProcessing = function (results) {
    return new Promise( async (resolve, reject) => {
        try {

            LOG.debug('PipelineImpl > %s %s Enter Post processing of results', this.context.pipelineName, this.context.id)
    
            if (!this.context.active) {
                reject('PipelineImpl > Post Processing - No Active Step for pipeline instance to process.')
            }
                    
            if (this.context.active.saveResultsIn && this.context.active.saveResultsIn.trim().length > 0) {
                this.context[this.context.active.saveResultsIn] = results
                resolve()
            } else {
                // Now call the postMapping function
                if (this.mapper) {
                    
                    // Build the post mapping function name
                    let tmpModel = this.context.active.model.replace(/\b\w/g, function(l){ return l.toUpperCase() })
                    let tmpMethod = ''
                    
                    if (Array.isArray(this.context.active.method)) {
                        tmpMethod = this.context.active.method[0].replace(/\b\w/g, function(l){ return l.toUpperCase() })
                    } else {
                        tmpMethod = this.context.active.method.replace(/\b\w/g, function(l){ return l.toUpperCase() })
                    }
                    
                    let postMappingFunctionName = 'post' + tmpModel + tmpMethod
        
                    LOG.verbose('PipelineImpl > %s %s Executing POST step method on the Pipeline Mapper Service called %s', this.context.pipelineName, this.context.id, postMappingFunctionName)
        
                    if (this.mapper[postMappingFunctionName]) {
                        this.context = this.mapper[postMappingFunctionName].call(null, results, this.context)
                        if (!this.context.id || !this.context.active) {
                            throw Error('Post processing function broke the context, please verify the function is returning the updated context.')
                        }
                        resolve()
                    } else {
                        reject('PipelineImpl > Mapper function ' + postMappingFunctionName + ' not found on.')
                    }
                } else {
                    reject('PipelineImpl > No Mapper defined.')
                }
            }

        } catch (err) {
            await this.error(err)
            reject(err)
        }
    })

}

PipelineImpl.prototype.preProcessing = function () {

    let serviceCallValues = []
    try {
        LOG.debug('PipelineImpl > %s %s Enter Pre processing to get service call arguments.', this.context.pipelineName, this.context.id)

        if (this.context.active.callServiceWithParams && Array.isArray(this.context.active.callServiceWithParams) && this.context.active.callServiceWithParams.length > 0) {
            
            LOG.debug('PipelineImpl > %s %s Pre function is using callServiceWithParams.', this.context.pipelineName, this.context.id)

            this.context.active.callServiceWithParams.forEach(path => {
                serviceCallValues.push(getValueFromPath(this.context, path))
            })

        } else {
            let tmpModel = this.context.active.model.replace(/\b\w/g, function(l){ return l.toUpperCase() })
            let tmpMethod = this.context.active.method.replace(/\b\w/g, function(l){ return l.toUpperCase() })
        
            let preMappingFunctionName = tmpModel + tmpMethod
        
            LOG.verbose('PipelineImpl > %s %s Executing PRE step method on the Pipeline Mapper Service called %s', this.context.pipelineName, this.context.id, preMappingFunctionName)
        
            if (!this.mapper[preMappingFunctionName]) {
                throw Error('PipelineImpl > Mapper function does not resolve to a function on the mapper script: %s' + preMappingFunctionName)
            }
        
            serviceCallValues = this.mapper[preMappingFunctionName].call(null, this.context)

            if (!Array.isArray(serviceCallValues)) {
                LOG.error('PipelineImpl > The pre processing response MUST be an array with the params to send to the subsequent function.')
            }
        }
    } catch (err) {
        throw Error(err)
    }

    return serviceCallValues
}

PipelineImpl.prototype.createInstance = function () {
    return new Promise(async (resolve, reject) => {
        try {
            this.instanceStore.create(this.context, (err, created) => {
                if (err) return reject(err)
    
                resolve(created)
            })    
        } catch (err) {
            await this.error(err)
            reject(err)
        }
        
    })
}

PipelineImpl.prototype.updateInstance = function () {
    return new Promise(async(resolve, reject) => {
        try {
            if (!this.context.id) return reject('PipelineImpl > Context id value missing or not yet set.')

            this.instanceStore.replaceById(this.context.id, this.context, (err, updated) => {
                if (err) return reject(err)
                this.context._rev = updated._rev
                resolve(updated)
            })

        } catch (err) {
            await this.error(err)
            reject(err)
        }
    })
}

PipelineImpl.prototype.acknowledge = function () {
    return { 'status': 'ok', 'id':  this.context.id }
}

PipelineImpl.prototype.calculateStepDuration = function () {
    let startDt = new Date(this.context.active.started)
    let endDt = new Date(this.context.active.ended)

    return endDt.getTime() - startDt.getTime()
}

PipelineImpl.prototype.calculatePipelineDuration = function () {
    let startDt = new Date(this.context.created)
    let endDt = new Date(this.context.ended)

    return endDt.getTime() - startDt.getTime()
}

// Function that will navigate to a specific dot notation field
// in the json and return the value
function getValueFromPath(json, path) {
    try {
        var _path = path.split('.')

        var cur = json
        _path.forEach(function (field) {
            if (cur[field]) {
                cur = cur[field]
            }
        })

        return cur
    } catch (err) {
        throw new Error('PipelineImpl > Error retrieving value of ' + path + ' using dot notation.')
    }
}


module.exports = PipelineImpl