'use strict'

const fs = require('fs')
const LOG = require('../../../utils/logger')

const formidable = require('formidable')

const VisualRecognitionV3 = require('watson-developer-cloud/visual-recognition/v3')

const visualRecognition = new VisualRecognitionV3({
    url: 'https://gateway.watsonplatform.net/visual-recognition/api',
    version: '2018-03-19',
    iam_apikey: process.env.WATSON_VR_API_KEY
})

module.exports = function (WatsonVR) {

    const uploadDir = __dirname + '/uploads'

    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir)
    }

    WatsonVR.classify = function(req, res, cb) {

        const form = new formidable.IncomingForm()

        form.parse(req)
        
        form.on('fileBegin', (name, file) => {
            file.path = uploadDir + '/' + file.name
        })
    
        form.on('file', (name, file) => {
            var params = {
                images_file: fs.createReadStream(file.path)
            }

            visualRecognition.classify(params, (err, resp) => {
                if (err) return cb(err)
                
                fs.unlinkSync(file.path)

                cb(null, resp)
            })
        })
    }

}
