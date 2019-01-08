'use strict'

const LOG = require('../../../../utils/logger.js')

const fs = require('fs')
const formidable = require('formidable')
const URL = require('url')
const request = require('request')

const PipelineController = require('../../pipeline-controller')
const cosUtils = require('../utils/cos-utils')
const mimeTypeHelper = require('../utils/mime-type-helper')

module.exports = function (Pipeline) {

    Pipeline.simpleTrigger = function (triggerReq, cb) {

        triggerReq.triggerType = 'simple'
        if (triggerReq.id) {
            PipelineController.resume(triggerReq).then((act) => {
                cb(null, act)
            }).catch((err) => {
                cb(err)
            })        
        } else {
            PipelineController.trigger(triggerReq).then((act) => {
                cb(null, act)
            }).catch((err) => {
                cb(err)
            })        
        }
        
    }

    Pipeline.postUploadTrigger = function (triggerReq, cb) {
        
        if (!triggerReq.fileName) return cb({'error': 'Filename missing.'})
        if (!triggerReq.pipelineName) return cb({'error': 'Pipeline name missing.'})
        
        let bucket = PipelineController.getBucket(triggerReq.pipelineName)

        triggerReq.triggerType = 'postUpload'

        cosUtils.fileExist(bucket, triggerReq.fileName, (err, metadata) => {
            if (err) return cb(err)

            if (triggerReq.id) {
                PipelineController.resume(triggerReq).then((act) => {
                    cb(null, act)
                }).catch((err) => {
                    cb(err)
                })    
            } else {
                PipelineController.trigger(triggerReq).then((act) => {
                    act.metadata = metadata
                    cb(null, act)
                }).catch((err) => {
                    cb(err)
                })    
            }    
        })
    }

    Pipeline.urlTrigger = function (triggerReq, cb) {
        if (!triggerReq.url) return cb({'error': 'Url missing.'})
        if (!triggerReq.fileName) return cb({'error': 'Filename missing.'})
        if (!triggerReq.pipelineName) return cb({'error': 'Pipeline name missing.'})

        let bucket = PipelineController.getBucket(triggerReq.pipelineName)
        let contentType = mimeTypeHelper.determineMimeType(triggerReq.fileName)

        triggerReq.triggerType = 'url'

        cosUtils.generateWriteUrl(bucket, triggerReq.fileName, contentType, async (err, access) => {

            await cosUtils.copyFile(triggerReq.url, access.writeUrl)

            if (triggerReq.id) {
                PipelineController.resume(triggerReq).then((act) => {
                    cb(null, act)
                }).catch((err) => {
                    cb(err)
                })    
            } else {
                PipelineController.trigger(triggerReq).then((act) => {
                    cb(null, act)
                }).catch((err) => {
                    cb(err)
                })    
            }    
        })
    }

    Pipeline.uploadTrigger = function (req, res, cb) {

        if (!fs.existsSync('./temp-storage')) {
            fs.mkdirSync('./temp-storage')
        }

        const startTime = new Date()

        var form = new formidable.IncomingForm()
        form.uploadDir = "./temp-storage"
        form.keepExtensions = true
        form.maxFileSize = 1024 * 1024 * 1024 // Limit file size to 1GB

        form.parse(req, (err, fields, files) => {

            if (!fields.pipelineName) return cb('Pipeline name missing.')
            if (!files || !files.file) return cb('File missing.')

            // Get the Pipeline Bucket from the definition
            let bucket = PipelineController.getBucket(fields.pipelineName)

            fs.renameSync(files.file.path, './temp-storage/' + files.file.name)

            cosUtils.streamFile('./temp-storage', bucket, files.file.name, async (err, results) => {

                if (fs.existsSync('./temp-storage/' + files.file.name)) fs.unlinkSync('./temp-storage/' + files.file.name)

                if (err) throw Error (err)

                let triggerReq = {
                    triggerType: 'upload',
                    fileName: files.file.name,
                    contentType: files.file.type                
                }
                triggerReq = Object.assign(fields, triggerReq)                
                // This trigger has an id, so we want to resume an existing pipeline
                if (fields.id) {
                    triggerReq.id = fields.id
                    PipelineController.resume(triggerReq).then((act) => {
                        cb(null, act)
                    }).catch((err) => {
                        cb(err)
                    })    
                } else {
                    triggerReq.pipelineName = fields.pipelineName,
                    PipelineController.trigger(triggerReq).then((act) => {
                        cb(null, act)
                    }).catch((err) => {
                        cb(err)
                    })    
                }
                
            })
        }) 
    }

    // REST API Endpoint for callback url when external services are called from the pipeline
    Pipeline.notify = function (notification, cb) {   

        LOG.debug('Pipeline REST Api notified for Pipeline instance: %o', notification)
        
        PipelineController.notify(notification.id, notification).then((act) => {

            LOG.debug('Pipeline REST Api notified the Pipeline Controller and received acknowedgement back. %o', act)
            cb(null, { 'status': 'ok', 'id': notification.id })
    
        }).catch((err) => {
            LOG.warn(err)
            cb(err)
        })
    }

    Pipeline.resume = function (resumeData, cb) {

        if (!resumeData.id) return cb('Pipeline Id (id) value must be supplied.')
        if (!resumeData.from) return cb('From (from) what step in form [model].[method].[index] must be supplied.')

        LOG.debug('Pipeline REST Api resumed Pipeline instance %s from %s ', resumeData.id, resumeData.from)

        PipelineController.resume(resumeData).then((act) => {
            LOG.debug('Pipeline REST Api resumed the Pipeline Controller and received acknowedgement back. %o', act)

            cb(null, { 'status': 'ok', 'id': resumeData.id })    

        }).catch((err) => {
            cb(err)
        })
    }
    
    Pipeline.status = function (id, cb) {
        PipelineController.status(id).then((status) => {

            cb(null, status)

        }).catch((err) => {
            cb(err)
        })
    }

    Pipeline.outcome = function (id, cb) {
        PipelineController.outcome(id).then((results) => {

            cb(null, results)

        }).catch((err) => {
            cb(err)
        })
    }

    Pipeline.retrieveObject = function (req, res, cb) {
        if (!req.body.id) return cb({'error': 'Id missing.'})
        if (!req.body.fileName) return cb({'error': 'Filename missing.'})

        let bucket = PipelineController.getBucketForInstance(req.body.id).then((bucket) => {
            cosUtils.generateReadUrl(bucket, req.body.fileName, (err, access) => {
                if (err) return cb(err)
    
                res.writeHead(200, {
                    'Content-Type': access.contentType,
                    'Content-disposition': 'attachment; filename=' + req.body.fileName
                });
    
                request.get(access.readUrl, (err, response, body) => {
                    LOG.debug('File was streamed from COS.')
                }).pipe(res)
    
            })    
        })
    }

    Pipeline.testServiceCall = function (params, cb) {
        PipelineController.testServiceCall(params, (err, resp) => {
            cb(err, resp)
        })
    }

    Pipeline.listObjectsInBucket = function (pipelineName, cb) {
        let bucket = PipelineController.getBucket(pipelineName)
        cosUtils.listObjects(bucket, (err, objects) => {
            if (err) return cb(err)

            cb(null, objects)
        })
    }

    Pipeline.getPipelineDefinitions = function (cb) {
        cb(null, PipelineController.getPipelineDefinitions())
    }

}
