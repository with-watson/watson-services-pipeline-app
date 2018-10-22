'use strict';

const LOG = require('../utils/logger.js')
const cosHelper = require('./utils/cos-helper')
const mimeTypeHelper = require('./utils/mime-type-helper')

module.exports = function(Ibmcos) {

    Ibmcos.getReadUrl = function (bucket, fileName, cb) {
        cosHelper.generateReadUrl(bucket, fileName, (err, access) => {
            if (err) return cb(err)
            cb(null, access)
        })
    }

    Ibmcos.getWriteUrl = function (bucket, fileName, cb) {
        let contentType = mimeTypeHelper.determineMimeType(fileName)
        cosHelper.generateWriteUrl(bucket, fileName, contentType, (err, access) => {
            if (err) return cb(err)
            cb(null, access)            
        })
    }

    Ibmcos.remoteMethod('getReadUrl', {
        'accepts': [
            {
                'arg': 'bucket',
                'type': 'string',
                'required': true
            },
            {
                'arg': 'fileName',
                'type': 'string',
                'required': true
            }
        ],
        'returns': {
            'arg': 'body',
            'type': 'object',
            'root': true
        },
        'http': {
            'verb': 'get'
        }
    })
    Ibmcos.remoteMethod('getWriteUrl', {
        'accepts': [
            {
                'arg': 'bucket',
                'type': 'string',
                'required': true
            },
            {
                'arg': 'fileName',
                'type': 'string',
                'required': true
            }
        ],
        'returns': {
            'arg': 'body',
            'type': 'object',
            'root': true
        },
        'http': {
            'verb': 'get'
        }
    })
};
