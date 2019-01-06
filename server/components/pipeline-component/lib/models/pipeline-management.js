'use strict'

const LOG = require('../../../../utils/logger.js')

const fs = require('fs')
const formidable = require('formidable')
const URL = require('url')
const request = require('request')

const PipelineController = require('../../pipeline-controller')
const cosUtils = require('../utils/cos-utils')
const mimeTypeHelper = require('../utils/mime-type-helper')

module.exports = function (PipelineManagement) {

    PipelineManagement.listAll = function (query, cb) {
        PipelineController.listAll(query).then(list => {
            cb (null, list)
        }).catch(err => {
            cb(err)
        })
    }

    PipelineManagement.findById = function (id, cb) {
        PipelineController.findById(id).then(inst => {
            cb (null, inst)
        }).catch(err => {
            cb(err)
        })
    }

    PipelineManagement.destroyById = function (id, cb) {
        LOG.info('Deleting Pipeline Instance with id: %s', id)
        PipelineController.destroyById(id).then(() => {
            cb (null, { 'success': true })
        }).catch(err => {
            cb(err)
        })
    }

    PipelineManagement.getPipelineStateSummary = function (byPeriod, cb) {
        PipelineController.getPipelineStateSummary(byPeriod).then(results => {
            cb(null, results)
        }).catch(err => {
            cb(err)
        })
    }

    PipelineManagement.getByPipelineState = function (state, startDt, endDt, limit, skip, cb) {
        PipelineController.getByPipelineState(state, startDt, endDt, limit, skip).then(results => {
            cb(null, results)
        }).catch(err => {
            cb(err)
        })
    }

    PipelineManagement.getFilesReadyToProcess = function (pipelineName, cb) {
        let bucket = PipelineController.getBucket(pipelineName)
        cosUtils.listObjects(bucket, (err, objects) => {
            if (err) return cb(err)

            //  Extract the filenames from the COS response
            let cosObjects = objects.Contents.map(obj => {
                return obj.Key
            })
            PipelineController.getFilesReadyToProcess(pipelineName, cosObjects).then(readyFiles => {
                cb(null, readyFiles)
            })
        })
    }
}
