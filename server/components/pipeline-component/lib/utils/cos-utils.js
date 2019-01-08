'use strict'

const LOG = require('../../../../utils/logger.js')

const fs = require('fs');
const IBMCOS = require('ibm-cos-sdk')
const request = require('request')
const { PassThrough } = require('stream')

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

function CosUtils() { }

CosUtils.prototype.bucketExist = function (bucket, create, callback) {

    LOG.debug('CosUtils > Checking if bucket exist: %s', bucket)

    cosImpl.headBucket({ Bucket: bucket }, (err, existing) => {
        if (err && err !== null) {
            if (create) {
                LOG.info('CosUtils > The requested bucket did not exist, creating it...')
                var params = {
                    Bucket: bucket,
                    CreateBucketConfiguration: {
                        LocationConstraint: "us-standard"
                    }
                }

                cosImpl.createBucket(params, (err, results) => {
                    if (err) return callback(err)
                    LOG.info('CosUtils > Bucket %s successfully created.', bucket)
                    callback(null, results)
                })

            } else {
                callback({ 'error': 'Bucket does not exist.' })
            }
        } else {
            LOG.debug('CosUtils > Bucket %s already exist.', bucket)
            callback(null, existing)
        }
    })
}

CosUtils.prototype.fileExist = function (bucket, fileName, callback) {

    let params = { Bucket: bucket, Key: fileName }

    cosImpl.headObject(params, (err, metadata) => {
        if (err) return callback(err)

        callback(null, metadata)
    })
}

CosUtils.prototype.listObjects = function (bucket, callback) {

    let params = { Bucket: bucket }

    cosImpl.listObjects(params, (err, data) => {
        if (err) return callback(err)

        callback(null, data)
    })
}

CosUtils.prototype.generateReadUrl = function (bucket, fileName, callback) {
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

CosUtils.prototype.generateWriteUrl = function (bucket, fileName, contentType, callback) {

    let params = { Bucket: bucket, Key: fileName, ContentType: contentType, Expires: 3600 }

    cosImpl.getSignedUrl('putObject', params, (err, writeUrl) => {
        if (err) return callback(err)
        callback(null, { writeUrl: writeUrl, key: fileName })
    })    
}

CosUtils.prototype.abortMultipartUploads = function (bucket, uploadId, fileName, callback) {
    let params = { Bucket: bucket, UploadId: uploadId, Key: fileName }
    cosImpl.abortMultipartUpload(params, (err, data) => {
        if (err) return callback(err)
        callback(null, { success: true })
    })
}

CosUtils.prototype.listMultipartUploads = function (bucket, callback) {
    let params = { Bucket: bucket }
    cosImpl.listMultipartUploads(params, (err, data) => {
        if (err) return callback(err)
        callback(null, data)
    })
}

CosUtils.prototype.streamFile = function (filePath, bucket, fileName, callback) {
    var readableStream = fs.createReadStream(filePath + '/' + fileName)
    cosImpl.upload({ Bucket: bucket, Key: fileName, Body: readableStream }, (err, data) => {
        if (err) return callback(err)

        LOG.info('Upload done...')
        
        callback(null, data)
    }).on('httpUploadProgress', (evt) => {
        LOG.info('Upload ' + Math.round((evt.loaded / evt.total) * 100) + '%')
    })
}

CosUtils.prototype.streamReadableStream = function (readableStream, bucket, fileName, contentType, pipelineId, callback) {

    var params = { Bucket: bucket, Key: fileName, Body: readableStream, ContentType: contentType }
    
    cosImpl.upload(params, (err, data) => {
        if (err) {
            LOG.error(err)
            return callback(err)
        }
        callback(null, data)
    }).on('httpUploadProgress', (evt) => {
        LOG.info('Upload ' + Math.round((evt.loaded / evt.total) * 100) + '%')
    })
}

CosUtils.prototype.copyFile = function (readUrl, writeUrl) {
    return new Promise((resolve, reject) => {
        let readOptions = {
            method: 'GET',
            url: readUrl
        }
        let writeOptions = {
            method: 'PUT',
            url: writeUrl
        }
        request(readOptions, (err, res, body) => {        
            if (err) {
                LOG.error('Error Reading File: ', err)
                return reject(err)
            }
            if (res.statusCode >= 300) {
                LOG.error(body)
                return reject(body)
            } else {
                LOG.debug('File successfully read from source URL.')
            }
        }).pipe(request(writeOptions, (err, res, body) => {
            if (err) {
                LOG.error('Error Writing file to COS: ', err)
                return reject(err)
            }
            if (res.statusCode >= 300) {
                LOG.error(body)
                return reject(body)
            } else {
                LOG.debug('File successfully saved to Cloud Object Storage.')
                resolve()
            }
        }))
    })
}

CosUtils.prototype.uploadMultipart = function (bucket, filePath, fileKey, contentType, callback) {
    var buffer = fs.readFileSync(filePath + '/' + fileKey);

    // Upload
    var startTime = new Date();
    var partNum = 0;
    var partSize = 1024 * 1024 * 20; // Minimum 20MB per chunk (except the last part)
    var numPartsLeft = Math.ceil(buffer.length / partSize);
    var maxUploadTries = 3;
    var multipartMap = {
        Parts: []
    }

    let multiPartParams = {
        Bucket: bucket,
        Key: fileKey,
        ContentType: contentType
    }

    createMultipartUpload(multiPartParams, (err) => {
        if (err) return callback(err)
        // Return to the caller
        callback()
    })

    function createMultipartUpload(multiPartParams, callback) {
        cosImpl.createMultipartUpload(multiPartParams, (err, multipart) => {
            if (err) return callback(err)

            LOG.debug("Got upload ID", multipart.UploadId);
            let partsSequence = []
            // Grab each partSize chunk and upload it as a part
            for (var rangeStart = 0; rangeStart < buffer.length; rangeStart += partSize) {
                partNum++;
                var end = Math.min(rangeStart + partSize, buffer.length)
                var partParams = {
                    Body: buffer.slice(rangeStart, end),
                    Bucket: bucket,
                    Key: fileKey,
                    PartNumber: String(partNum),
                    UploadId: multipart.UploadId
                }
                partsSequence.push(partParams)
            }
            LOG.debug('There are ' + partsSequence.length + ' parts to upload.')
            // Initiate the multipart upload by sending the first part
            uploadPart(multipart, partsSequence, 0);
            callback()
        })
    }

    function uploadPart(multipart, partsSequence, index, tryNum) {
        let partParams = partsSequence[index]
        index++
        LOG.debug('Uploading part: #', partParams.PartNumber, ', Size of request:', partParams.Body.length);
        var tryNum = tryNum || 1;
        cosImpl.uploadPart(partParams, (err, data) => {
            if (err) {
                LOG.debug('multiErr, upload part error:', err);
                if (tryNum < maxUploadTries) {
                    LOG.debug('Retrying upload of part: #', partParams.PartNumber)
                    uploadPart(cosImpl, multipart, partsSequence, index - 1, tryNum + 1);
                } else {
                    LOG.debug('Failed uploading part: #', partParams.PartNumber)
                }
                return;
            }
            multipartMap.Parts[partParams.PartNumber - 1] = {
                ETag: data.ETag,
                PartNumber: Number(partParams.PartNumber)
            }
            LOG.debug("Completed part", partParams.PartNumber);
            LOG.debug('mData', data);
            if (--numPartsLeft > 0) {
                return uploadPart(multipart, partsSequence, index);
            }

            var doneParams = {
                Bucket: partParams.Bucket,
                Key: partParams.Key,
                MultipartUpload: multipartMap,
                UploadId: partParams.UploadId
            };

            LOG.debug("Completing upload...");
            completeMultipartUpload(doneParams);
        })
    }

    function completeMultipartUpload(doneParams) {
        cosImpl.completeMultipartUpload(doneParams, (err, data) => {
            if (err) return callback(err)
            callback(null, data)
            var delta = (new Date() - startTime) / 1000;
            LOG.debug('Completed upload in', delta, 'seconds');
            LOG.debug('Final upload data:', data);
        })
    }
}

CosUtils.prototype.deleteObject = function (bucket, fileName, callback) {
    let params = { Bucket: bucket, key: fileName }
    cosImpl.deleteObject(params, (err, deleted) => {
        if (err) return callback(err)
        callback(deleted)
    })
}

CosUtils.prototype.deleteObjects = function (bucket, fileNames, callback) {
    let params = { 
        Bucket: bucket, 
        Delete: {
            Objects: []
        }
    }
    for (let fileName of fileNames) {
        let key = {
            Key: fileName
        }
        params.Delete.Objects.push(key)
    }

    cosImpl.deleteObjects(params, (err, deleted) => {
        if (err) return callback(err)
        callback(null, deleted)
    })
}

module.exports = new CosUtils()
