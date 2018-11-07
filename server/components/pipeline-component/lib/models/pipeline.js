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
    Pipeline.simpleTrigger = function (triggerData, cb) {
        if (triggerData.id) {
            PipelineController.resume(triggerData).then((act) => {
                cb(null, act)
            }).catch((err) => {
                cb(err)
            })        
        } else {
            PipelineController.trigger(triggerData).then((act) => {
                cb(null, act)
            }).catch((err) => {
                cb(err)
            })        
        }
    }
    Pipeline.urlTrigger = function (triggerData, cb) {
        if (!triggerData.url) return cb({'error': 'Url missing.'})
        if (!triggerData.fileName) return cb({'error': 'Filename missing.'})
        if (!triggerData.pipelineName) return cb({'error': 'Pipeline name missing.'})

        let bucket = PipelineController.getBucket(triggerData.pipelineName)
        let contentType = mimeTypeHelper.determineMimeType(triggerData.fileName)

        LOG.debug('Pipline is triggered with a URL.')

        cosUtils.generateWriteUrl(bucket, triggerData.fileName, contentType, async (err, access) => {

            await cosUtils.copyFile(triggerData.url, access.writeUrl)

            if (triggerData.id) {
                PipelineController.resume(triggerData).then((act) => {
                    cb(null, act)
                }).catch((err) => {
                    cb(err)
                })    
            } else {
                PipelineController.trigger(triggerData).then((act) => {
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

                let triggerData = {
                    fileName: files.file.name,
                    contentType: files.file.type                
                }
                triggerData = Object.assign(fields, triggerData)                
                // This trigger has an id, so we want to resume an existing pipeline
                if (fields.id) {
                    triggerData.id = fields.id
                    PipelineController.resume(triggerData).then((act) => {
                        cb(null, act)
                    }).catch((err) => {
                        cb(err)
                    })    
                } else {
                    triggerData.pipelineName = fields.pipelineName,
                    PipelineController.trigger(triggerData).then((act) => {
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

        LOG.debug('Pipeline REST Api resumed Pipeline instance: ', resumeData.id)

        PipelineController.resume(resumeData).then((act) => {
            LOG.debug('Pipeline REST Api resumed the Pipeline Controller and received acknowedgement back. %o', act)

            cb(null, { 'status': 'ok', 'id': resumeData.id })    

        }).catch((err) => {
            cb(err)
        })
    }

}
