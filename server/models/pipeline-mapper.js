'use strict';

const LOG = require('../utils/logger.js')

module.exports = function(PipelineMapper) {

    PipelineMapper.postSimpleTrigger = function (result, context, idx) {
        return context
    }

    PipelineMapper.PipelineSvcExampleGetArrayValues = function (context) {
        return [
            context.id
        ]
    }

    PipelineMapper.allValuesProcessed = function (context, idx) {
        LOG.info('Checking if ' + idx + ' >= ' + context.array_values.length)
        return idx >= context.array_values.length
    }

    PipelineMapper.PipelineSvcExampleProcessArrayValue = function (context) {
        LOG.info('PipelineSvcExampleProcessArrayValue', context.active.forloop_index, context.array_values[context.active.forloop_index])

        return [
            context.array_values[context.active.forloop_index],
            context.active.forloop_index,
            context.id
        ]
    }

    PipelineMapper.postPipelineSvcExampleProcessArrayValue = function (results, context) {
        if (!context.process_array_results) context.process_array_results = []
        context.process_array_results.push(results)
        return context                
    }

    PipelineMapper.postPipelineSvcExampleGetArrayValues = function (results, context) {
        context.array_values = results.values
        return context
    }

    PipelineMapper.PipelineSvcExampleAsyncCall = function (context) {
        return [
            context
        ]
    }

    PipelineMapper.postPipelineSvcExampleAsyncCall = function (results, context) {
        if (context.testResults) {
            context.testResults.push(results.results)
        } else {
            context.testResults = [results.results]
        }
        return context
    }

    PipelineMapper.PipelineSvcExampleSyncCall = function (context) {
        return [
            context.id
        ]
    }

    PipelineMapper.postPipelineSvcExampleSyncCall = function (results, context) {
        if (context.testResults) {
            context.testResults.push(results)
        } else {
            context.testResults = [results]
        }
        return context
    }

};
