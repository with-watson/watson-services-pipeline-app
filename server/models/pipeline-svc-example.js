'use strict'

const LOG = require('../utils/logger.js')

const PipelineController = require('../components/pipeline-component/pipeline-controller')
const request = require('request')
const pipelineHelper = require('./utils/pipeline-helper')

module.exports = function(PipelineExample) {

    // This is the most simple service call.  A sync service call where the pipeline will
    // wait for a response.
    PipelineExample.syncCall = function (id, cb) {
        cb(null, { 'status': 'ok', 'id': id })

        setTimeout(() => {
            PipelineController.notify(id, { 'field': 'value' })
        }, 2000)
    }

    // This is an example of a service method that will process an array of values.
    PipelineExample.processArrayValue = function (value, idx, id, cb) {
        cb(null, { 'status': 'ok' , 'id': id })

        LOG.info('In processArrayValue ', value, idx, id )
        let val = value * 100

        PipelineController.notify(id, { 'value': val }).then()
    }

    // This is an example of s service method that returns an array of values.
    PipelineExample.getArrayValues = function (id, cb) {
        cb(null, { 'status': 'ok' , 'id': id })
        let numbers = []
        for (let i=0; i<10; i++) {
            numbers.push(Math.random())
        }
        PipelineController.notify(id, { values: numbers }).then()
    }

    // This is an example of an async service methop.  This does a callback back to the pipeline
    // once the work is complete.
    PipelineExample.asyncCall = function (context, cb) {

        cb(null, { 'status': 'ok', 'id': context.id })

        pipelineHelper.getCallbackToken((err, token) => {
            if (err) return cb(err)
            let callbackUrl = process.env.BASE_URL + '/api/Pipeline/notify?access_token=' + token
            // After this will actually be implemented by the external service.
            setTimeout(() => {
                let opts = {
                    url: callbackUrl,
                    body: {
                        id: context.id,
                        results: {
                            "field": "value"
                        }
                    },
                    json: true
                }
                request.post(opts, (err, response, body) => {
                    if (err) return LOG.error(err)
                    LOG.info('Pipeline Example Service was acknowledged.', body)
                })
            }, 5000)
        })
    }
}
