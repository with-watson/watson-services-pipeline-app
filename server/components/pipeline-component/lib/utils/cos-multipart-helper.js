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

module.exports = function CosMultipartHelper(_form) { 
    this.form = _form

    this.form.on('fileBegin', (name, file) => {
        console.log('File Begin...`')
    })

    this.form.on('end', () => {
        console.log('Form end...`')
    })
    form.onPart = (part) => {
        if (!part.filename) {
            console.log('File part...')
        }
    }
}

 function uploadMultipart (bucket, filePath, fileKey, contentType, cb) {
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
        if (err) return cb(err)
        // Return to the caller
        cb()
    })

    function createMultipartUpload(multiPartParams, cb) {
        cosImpl.createMultipartUpload(multiPartParams, (err, multipart) => {
            if (err) return cb(err)

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
            cb()
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
            if (err) return cb(err)
            cb(null, data)
            var delta = (new Date() - startTime) / 1000;
            LOG.debug('Completed upload in', delta, 'seconds');
            LOG.debug('Final upload data:', data);
        })
    }
}