'use strict'

const LOG = require('../utils/logger.js')

const request = require('request')

// The Pipeline Controller is used to interact with the pipeline runtime
const PipelineController = require('../components/pipeline-component/pipeline-controller')
// The pipeline helper is a utility module that contains helper functions for interacting with the pipeline
const pipelineHelper = require('./utils/pipeline-helper')

module.exports = function(PipelineExample) {

    // This is the most simple service call.  A sync service call where the pipeline will
    // wait for a response.
    PipelineExample.syncCall = function (id, cb) {
        cb(null, { 'status': 'ok', 'id': id })

        setTimeout(() => {
            // Use the PipelineController to notify the pipeline of the response.
            PipelineController.notify(id, { 'field': 'value' }).then()
        }, 2000)
    }

    // This is an example of a service method that will process an array of values.
    PipelineExample.processArrayValue = function (value, idx, id, cb) {
        cb(null, { 'status': 'ok' , 'id': id })

        LOG.info('In processArrayValue ', value, idx, id )
        let val = value * 100

        // Use the PipelineController to notify the pipeline of the response.
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

        // Use the Pipeline Helper to retrieve the token for the callback.
        pipelineHelper.getCallbackToken((err, token) => {
            if (err) return cb(err)
            // Construct the callback url with the token.
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
                // Send the notification back to the pipeline.
                request.post(opts, (err, response, body) => {
                    if (err) return LOG.error(err)
                    LOG.info('Pipeline Example Service was acknowledged.', body)
                })
            }, 5000)
        })
    }
}
