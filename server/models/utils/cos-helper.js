'use strict'

const LOG = require('../../utils/logger.js')

const IBMCOS = require('ibm-cos-sdk')
const request = require('request')

// Use the HMAC Authentication method to authenticate against COS
const config = {
    endpoint: process.env.CLOUD_OBJECT_STORAGE_API_ENDPOINT,
    credentials: {
        'accessKeyId': process.env.CLOUD_OBJECT_STORAGE_AWS_API_KEY_ID,
        'secretAccessKey': process.env.CLOUD_OBJECT_STORAGE_AWS_API_KEY,
        'signatureVersion': 'v4'
    }
}

var cosImpl = new IBMCOS.S3(config);

var CosHelper = function () {}

CosHelper.prototype.generateReadWriteUrl = function (bucket, readFileName, writeFilename, writeContentType, callback) {
    
    LOG.info(bucket, readFileName, writeFilename, writeContentType)

    this.generateReadUrl(bucket, readFileName, (err, writeAccess) => {
        if (err) return callback(err)
        this.generateWriteUrl(bucket, writeFilename, writeContentType, (err, readAccess) => {
            if (err) return callback(err)
            callback(null, Object.assign(readAccess, writeAccess))
        })
    })
}

CosHelper.prototype.generateReadUrl = function (bucket, fileName, callback) {
    let params = { Bucket: bucket, Key: fileName }

    LOG.info(bucket, fileName)

    // Check if the requested object exist
    cosImpl.headObject(params, (err, metadata) => {
        if (err) return callback(err)
        // Create the signed url when the object exist
        cosImpl.getSignedUrl('getObject', params, (err, readUrl) => {
            if (err) return callback(err)
            LOG.info(readUrl)
            callback(null, { readUrl: readUrl, contentType: metadata.ContentType })
        })
    })        
}

CosHelper.prototype.generateWriteUrl = function (bucket, fileName, contentType, callback) {

    let params = { Bucket: bucket, Key: fileName, ContentType: contentType, Expires: 3600 }

    cosImpl.getSignedUrl('putObject', params, (err, writeUrl) => {
        if (err) return callback(err)
        callback(null, { writeUrl: writeUrl, key: fileName })
    })    
}

module.exports = new CosHelper()