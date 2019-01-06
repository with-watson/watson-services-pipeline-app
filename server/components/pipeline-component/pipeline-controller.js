'use strict'

const EventEmitter = require('events').EventEmitter

const util = require('util')

const LOG = require('../../utils/logger.js')
const PipelineImpl = require('./lib/pipeline-impl')
const cosUtils = require('./lib/utils/cos-utils')

const Moment = require('moment')

function PipelineController() { }

util.inherits(PipelineController, EventEmitter);

PipelineController.prototype.initialize = function (_app) {
    return new Promise(async (resolve, reject) => {

        this.app = _app

        this.mode = 'PROD'

        this.instanceStore = this.app.models['PipelineInst']

        if (!this.instanceStore) throw Error('No Pipeline instance store defined.')

        this.definitionCache = {}
        this.instanceCache = {}

        LOG.debug('Pipeline Controller initialized.')

        resolve()
    })
}

PipelineController.prototype.register = function (definition) {
    return new Promise(async (resolve, reject) => {
        let err = await validateDefinition(this.app, definition)

        if (err) return reject(err)

        // Check if the bucket is created for COS otherwise create it
        cosUtils.bucketExist(definition.bucket, true, (err) => {
            if (err) return reject(err)

            this.definitionCache[definition.name] = definition

            LOG.debug('%s Pipeline Controller registed a definition.', definition.name)

            resolve()
        })
    })
}

// Trigger a pipeline instance
PipelineController.prototype.trigger = function (triggerReq) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!this.definitionCache[triggerReq.pipelineName]) {
                return reject('Pipeline name does not resolve to a pipeline definition.')
            }
            // Create a new instance of the pipeline
            let pipelineInstance = new PipelineImpl(this.app, this.definitionCache[triggerReq.pipelineName])

            let act = await pipelineInstance.initialize()

            this.instanceCache[act.id] = pipelineInstance

            // Trigger the pipeline instance to start the step execution
            act = await pipelineInstance.trigger(triggerReq)

            // Emit the trigger event
            this.emit('trigger', pipelineInstance.context)

            LOG.debug('%s %s Pipeline Controller was triggered and produced instance.', triggerReq.pipelineName, act.id)

            // If the pipeline is done, then complete the instance
            if (pipelineInstance.done) {
                await this.complete(act.id)
                LOG.debug('%s %s Pipeline Controller completes pipeline in trigger function for instance.', triggerData.pipelineName, act.id)
            }

            resolve(act)

        } catch (err) {
            reject(err)
        }
    })
}

// Inbound
PipelineController.prototype.notify = async function (id, results) {
    try {

        LOG.debug('PipelineController.notify')

        if (this.mode === 'TEST') {

            LOG.info('PipelineController is in TEST mode and will end here.')

            this.mode === 'PROD'

            return resolve({})
        }

        let pipelineInstance = await this.retrieveInstance(id)
        
        if (!pipelineInstance) {
            throw new Error('Pipeline instance ' + id + ' not found.')
        }
        if (!pipelineInstance.context.state === 'failed' || pipelineInstance.context.state === 'completed') {
            throw new Error('Pipeline instance ' + id + ' is in ' + pipelineInstance.state + ' state and cannot be notified.')
        }

        this.emit('notify', pipelineInstance.context)

        // Call the active pipeline instance
        let act = await pipelineInstance.notify(results).catch(err => {
            throw new Error(err)
        })

        LOG.debug('%s %s Pipeline Controller notified instance.', pipelineInstance.context.pipelineName, pipelineInstance.context.id)

        if (pipelineInstance.done) {
            await this.complete(act.id).catch(err => {
                reject(err)
            })
            LOG.debug('%s %s Pipeline Controller completes pipeline in notification function for instance.', pipelineInstance.context.pipelineName, pipelineInstance.context.id)
        }


    } catch (err) {
        LOG.error('PipelineController.notify > ', err)
        this.emit('error', [err])
    }

}

PipelineController.prototype.notifyOfError = async function (id, err) {

    try {

        LOG.warn('PipelineController.notifyOfError > %o', err)

        let pipelineInstance = await this.retrieveInstance(id)

        if (!pipelineInstance) {
            LOG.warn('Pipeline instance ' + id + ' not found.')
            return
        }
        if (!pipelineInstance.context.state === 'failed' || pipelineInstance.context.state === 'completed') {
            LOG.warn('Pipeline instance ' + id + ' is in ' + pipelineInstance.state + ' state and cannot be notified.')
            return
        }

        await pipelineInstance.error(err.message)

        this.emit('error', [err, this.context])

    } catch (err) {
        LOG.error('PipelineController.notifyOfError > %o', err)
        this.emit('error', [err])
    }

}

// Inbound
PipelineController.prototype.resume = function (resumeData) {
    return new Promise(async (resolve, reject) => {
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
    return new Promise(async (resolve, reject) => {
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
    return new Promise(async (resolve, reject) => {
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
    return new Promise(async (resolve, reject) => {
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
                LOG.debug('Instance %s was found in the cache.', id)
                return resolve(this.instanceCache[id])
            }
            LOG.warn('%s Pipeline instance is being retrieved from the instance datasource.', id)
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

PipelineController.prototype.listAll = function (query) {
    return new Promise((resolve, reject) => {
        try {
            this.instanceStore.find(query, (err, found) => {
                if (err) return reject(err)
                found = found.map(v => {
                    delete v.history
                    return v
                })
                resolve(found)
            })
        } catch (err) {
            LOG.error('PipelineController.listAll > ', err)
            this.emit('error', [err, this.context])
            reject(err)
        }
    })
}

PipelineController.prototype.findById = function (id) {
    return new Promise((resolve, reject) => {
        try {
            this.instanceStore.findById(id, (err, found) => {
                if (err) return reject(err)
                resolve(found)
            })
        } catch (err) {
            LOG.error('PipelineController.findById > ', err)
            this.emit('error', [err, this.context])
            reject(err)
        }
    })
}

PipelineController.prototype.destroyById = function (id) {
    return new Promise((resolve, reject) => {
        try {
            LOG.info('Deleting instance %s', id)
            this.instanceStore.destroyById(id, (err) => {
                if (err) return reject(err)
                resolve()
            })
        } catch (err) {
            LOG.error('PipelineController.findById > ', err)
            this.emit('error', [err, this.context])
            reject(err)
        }
    })
}

PipelineController.prototype.getPipelineStateSummary = function (byPeriod) {
    return new Promise(async (resolve, reject) => {
        try {

            if (this.instanceStore.getDataSource().connector.name === 'mongodb') {
                let collection = this.instanceStore.getDataSource().connector.collection('PipelineInst')

                let groupLevel = {
                    state: '$state'
                }
    
                switch (byPeriod) {
                    case 'year':
                        groupLevel.year = {
                            $year: {
                                $dateFromString: {
                                    dateString: "$created"
                                }
                            }
                        }
                        break
                    case 'month':
                        groupLevel.month = {
                            $month: {
                                $dateFromString: {
                                    dateString: "$created"
                                }
                            }
                        }
                        break
                    case 'day':
                        groupLevel.day = {
                            $dayOfMonth: {
                                $dateFromString: {
                                    dateString: "$created"
                                }
                            }
                        }
                        break
                    case 'hour':
                        groupLevel.hour = {
                            $hour: {
                                $dateFromString: {
                                    dateString: "$created"
                                }
                            }
                        }
                        break
                }
                let cursor = collection.aggregate([{ $match: {} }, {
                    $group: {
                        _id: groupLevel,
                        count: { $sum: 1 }
                    }
                }])
    
                cursor.get((err, data) => {
                    if (err) return reject(err)
    
                    let resp = {
                        completed: 0,
                        active: 0,
                        failed: 0
                    }
    
                    for (let d of data) {
                        resp[d._id.state] = d.count
                    }
                    resolve(resp)
                })
            }

            if (this.instanceStore.getDataSource().connector.name === 'cloudant') {

                // Below code is for a Cloudant DB

                let groupLevel = 1 // Default to only the state.  It will return all the docs aggregated
                switch (byPeriod) {
                    case 'year': 
                        groupLevel = 2
                        break
                    case 'month':
                        groupLevel = 3
                        break
                    case 'day':
                        groupLevel = 4
                        break
                    case 'hour':
                        groupLevel = 5
                        break                    
                }
                // Controlling parameters for the view call
                let params = {
                    startkey: [ '', 0, 0, 0, 0 ],
                    endkey: [ 'z', 9999, 12, 31, 24 ],
                    inclusive_end: true, 
                    group_level: groupLevel, 
                    reduce: true
                }
                this.instanceStore.getDataSource().connector.viewDocs('pipeline-db-design', 'state-view', params, (err, results) => {
                    if (err) return reject(err)

                    resolve(results)
                })
            }

            if (this.instanceStore.getDataSource().connector.name === 'memory') {

                let statesArray = ["completed", "active", "failed"]
                let stateResults = {
                    completed: 0,
                    active: 0,
                    failed: 0
                }

                function getCount (state, is) {
                    return new Promise((resolve, reject) => {
                        is.count({ 'state' : state }, (err, count) => {
                            if (err) return reject(err)
                            let results = {
                                state: state,
                                count: 0
                            }
                            results.count = count
                            resolve(results)
                        })    
                    })
                }

                async function getAllCounts (array, is) {
                    // map array to promises
                    const promises = array.map((s) => getCount(s, is));
                    // wait until all promises are resolved
                    let results = await Promise.all(promises);

                    return results
                }

                let results = await getAllCounts(statesArray, this.instanceStore)

                results.map(v => stateResults[v.state] = v.count)

                resolve(stateResults)
            }
        } catch (err) {
            LOG.error('PipelineController.getStateSummary > ', err)
            reject(err)
        }
    })
}

PipelineController.prototype.getByPipelineState = function (state, startDt, endDt, limit, skip) {
    return new Promise((resolve, reject) => {
        try {

            if (!limit) limit = 10
            if (!skip) skip = 0

            let startMoment = Moment(startDt)
            let endMoment = Moment(endDt)

            if (this.instanceStore.getDataSource().connector.name === 'mongodb') {

                let collection = this.instanceStore.getDataSource().connector.collection('PipelineInst')

                // First get the total number of docs for the query
                let cursor = collection.aggregate([{ $match: { $and: [{ state: state }, { created: { $gt: startMoment.toISOString() } }, { created: { $lt: endMoment.toISOString() } }] } }, { $group: { _id: null, count: { $sum: 1 } } }])

                cursor.get((err, data) => {

                    if (!data || data.length === 0) {
                        return resolve({
                            total_rows: 0,
                            rows: []
                        })
                    }
                    let total_rows = data[0].count

                    // Now find the matching docs with skip and limit
                    this.instanceStore.find({
                        where: { state: { eq: state }, and: [{ created: { gt: startMoment.toISOString() } }, { created: { lt: endMoment.toISOString() } }] },
                        limit: limit,
                        skip: skip,
                        order: "created DESC"
                    }, (err, data) => {
                        if (err) return reject(err)

                        let resp = {
                            total_rows: total_rows,
                            rows: data
                        }
                        resolve(resp)
                    })
                })
            }

            if (this.instanceStore.getDataSource().connector.name === 'cloudant') {

                let startKey = [ state, endDt.getFullYear(), endDt.getMonth(), endDt.getDate(), endDt.getHours() ]
                let endKey = [ state, startDt.getFullYear(), startDt.getMonth(), startDt.getDate(), startDt.getHours()]

                // Controlling parameters for the view call
                let params = {
                    include_docs: false, 
                    descending: true, 
                    endkey: endKey, 
                    startkey: startKey,
                    inclusive_end: true, 
                    reduce: true
                }

                // First call the view with reduce = true to get the total number of docs
                this.instanceStore.getDataSource().connector.viewDocs('pipeline-db-design', 'state-view', params, (err, results) => {
                    if (err) return reject(err)

                    let total_rows = 0

                    if (results.rows && results.rows.length) {
                        total_rows = results.rows[0].value
                    }

                    params.skip = skip
                    params.limit = limit
                    params.reduce = false

                    this.instanceStore.getDataSource().connector.viewDocs('pipeline-db-design', 'state-view', params, (err, results) => {
                        if (err) return reject(err)

                        results.total_rows = total_rows
                        delete results.offset  // Useless field that just confuses the situation

                        resolve(results)
                    })    
                })
            }

            if (this.instanceStore.getDataSource().connector.name === 'memory') {

                this.instanceStore.find({ where: { state: state }}, (err, data) => {
                    if (err) return reject(err)

                    let resp = {
                        total_rows: data.length,
                        rows: data
                    }

                    resolve(resp)
                })

            }

        } catch (err) {
            LOG.error('PipelineController.getByPipelineState > ', err)
            reject(err)
        }
    })
}

PipelineController.prototype.getBucketForInstance = function (id) {
    return new Promise(async (resolve, reject) => {
        let pipelineInstance = await this.retrieveInstance(id)

        resolve(pipelineInstance.definition.bucket)
    })
}

PipelineController.prototype.getBucket = function (pipelineName) {
    LOG.info('Bucket retrieved: ' + this.definitionCache[pipelineName].bucket)
    return this.definitionCache[pipelineName].bucket
}

PipelineController.prototype.testServiceCall = function (params, cb) {

    this.mode = 'TEST'

    LOG.info('Testing Service Call: %s.%s', params.model, params.method)

    let args = params.args

    args.push(function (err, resp) {
        cb(err, resp)
    })

    this.app.models[params.model][params.method].apply(null, args)
}

PipelineController.prototype.getPipelineDefinitions = function () {
    return this.definitionCache
}

PipelineController.prototype.getFilesReadyToProcess = function (pipelineName, cosObjects) {
    return new Promise((resolve, reject) => {

        let collection = this.instanceStore.getDataSource().connector.collection('PipelineInst')

        // Find all the completed pipeline instances in the database and return only the filename
        collection.find({ state: 'completed' }, { projection: { triggerFile: true }}, (err, results) => {
            if (err) return reject(err)

            results.toArray((err, resultsAsArray) => { 

                // Create a Hash from the files already processed
                let doneFiles = {}

                resultsAsArray.forEach(doc => {
                    if (doc.triggerFile) {
                        doneFiles[doc.triggerFile] = true
                    }
                })
                let readyFiles = cosObjects.filter(cosFileName => {
                    return doneFiles[cosFileName] ? false : true
                })
                resolve(readyFiles)

            })

        })

        // let params = {
        //     startKey: [pipelineName, ''],
        //     endKey: [pipelineName, 'z'],
        //     inclusive_end: true
        // }
        // this.instanceStore.getDataSource().connector.viewDocs('pipeline-db-design', 'file-view', params, (err, results) => {
        //     if (err) return reject(err)

        //     // Create a Hash from the files already processed
        //     let doneFiles = {}
        //     results.rows.forEach(row => {
        //         doneFiles[row.value.fileName] = true
        //     })
        //     let readyFiles = cosObjects.filter(cosFileName => {
        //         return doneFiles[cosFileName] ? false : true
        //     })
        //     resolve(readyFiles)
        // })
    })
}

function validateDefinition(_app, definition) {
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
        if (typeof step.method === 'string') {
            if (!_app.models[step.model][step.method]) return 'Step ' + i + ' method/function does not existing on model script.'
        }
        if (Array.isArray(step.method)) {
            step.method.forEach(m => {
                if (!_app.models[step.model][m]) return 'Step ' + i + ' method/function ' + m + ' does not existing on model script.'
            })
        }
        i++
    }
    LOG.debug('Definition ' + definition.name + ' validated successfully...')
}

module.exports = new PipelineController()