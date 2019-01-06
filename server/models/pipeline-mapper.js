'use strict';

const LOG = require('../utils/logger.js')

/**
 * This is an example file of a Pipeline Mapper Service.
 * Except for  Trigger function, each step in the pipeline must have a pre and post mapper function.
 * The pre-function must have a name of [Model][Function].  The pipeline runtime will pass this function the pipeline context.
 * The post-function must have a name of post[Model][Function].  The pipeline runtime will pass this function the results of the
 * service call and the context.  It is the responsibility of this function to map the results to the context.
 */
module.exports = function(PipelineMapper) {

    // Map some data in the trigger to the context.
    PipelineMapper.postPipelineSimpleTrigger = function (result, context, idx) {
        return context
    }

    // Pre call function of a service that will return an array of values
    PipelineMapper.PipelineSvcExampleGetArrayValues = function (context) {
        return [
            context.id
        ]
    }

    // Post call function of a service that  will return an array of values
    PipelineMapper.postPipelineSvcExampleGetArrayValues = function (results, context) {
        
        context.array_values = results.values

        return context
    }

    // This is an example of an `until` function.
    PipelineMapper.allValuesProcessed = function (context, idx) {
        LOG.info('Checking if ' + idx + ' >= ' + context.array_values.length)
        return idx >= context.array_values.length
    }

    // Pre call function of a service that processes an array of values.
    PipelineMapper.PipelineSvcExampleProcessArrayValue = function (context) {

        LOG.info('PipelineSvcExampleProcessArrayValue', context.active.forloop_index, context.array_values[context.active.forloop_index])

        return [
            context.array_values[context.active.forloop_index],
            context.active.forloop_index,
            context.id
        ]
    }

    // Post call function of a service that processes an array of values.
    PipelineMapper.postPipelineSvcExampleProcessArrayValue = function (results, context) {

        if (!context.process_array_results) context.process_array_results = []
        context.process_array_results.push(results)

        return context                
    }

    // Basic async pre call mapper function
    PipelineMapper.PipelineSvcExampleAsyncCall = function (context) {
        return [
            context
        ]
    }

    // Basic async post call mapper function
    PipelineMapper.postPipelineSvcExampleAsyncCall = function (results, context) {
        if (context.testResults) {
            context.testResults.push(results.results)
        } else {
            context.testResults = [results.results]
        }
        return context
    }

    // Basic sync pre call mapper function
    PipelineMapper.PipelineSvcExampleSyncCall = function (context) {
        return [
            context.id
        ]
    }

    // Basic sync post call mapper function
    PipelineMapper.postPipelineSvcExampleSyncCall = function (results, context) {
        if (context.testResults) {
            context.testResults.push(results)
        } else {
            context.testResults = [results]
        }
        return context
    }

};
