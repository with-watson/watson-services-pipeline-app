'use strict'

const LOG = require('../utils/logger.js')

const PipelineController = require('../components/pipeline-component/pipeline-controller')
const request = require('request')
const pipelineHelper = require('./utils/pipeline-helper')

module.exports = function(PipelineExample) {

    PipelineExample.processArrayValue = function (value, idx, id, cb) {
        cb(null, { 'status': 'ok' , 'id': id })

        LOG.info('In processArrayValue ', value, idx, id )
        let val = value * 100

        PipelineController.notify(id, { 'value': val }).then()
    }

    PipelineExample.getArrayValues = function (id, cb) {
        cb(null, { 'status': 'ok' , 'id': id })
        let numbers = []
        for (let i=0; i<10; i++) {
            numbers.push(Math.random())
        }
        PipelineController.notify(id, { values: numbers }).then()
    }
    PipelineExample.syncCall = function (id, cb) {
        cb(null, { 'status': 'ok', 'id': id })

        setTimeout(() => {
            PipelineController.notify(id, { 'field': 'value' })
        }, 2000)
    }
    PipelineExample.asyncCall = function (context, cb) {

        cb(null, { 'status': 'ok', 'id': context.id })

        pipelineHelper.getCallbackToken((err, token) => {
            if (err) return cb(err)
            let callbackUrl = 'http://localhost:3000/api/Pipeline/notify' + '?access_token=' + token
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
