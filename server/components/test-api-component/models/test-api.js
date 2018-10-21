'use strict';

const formidable = require('formidable')
const moment = require('moment')

module.exports = function(TestApi) {

    TestApi.get = function (req, cb) {

        let resp = {
            "receivedAtServer": moment().valueOf()
        }
        
        for (let id in req.query) {
            if (id === 'access_token') continue

            resp[id] = req.query[id]
        }

        cb(null, resp)
    }

    TestApi.postFormData = function (req, res, cb) {
        var form = new formidable.IncomingForm();

        form.parse(req, function(err, fields, files) {
            if (err) return cb(err)

            let resp = {
                "receivedAtServer": moment().valueOf()
            }

            for (let fld in fields) {
                resp[fld] = fields[fld]
            }

            cb(null, resp)
        })
    }

    TestApi.postUrlEncoded = function (req, res, cb) {
        let resp = {
            "receivedAtServer": moment().valueOf()
        }

        for (let fld in req.body) {
            
            if (fld === 'access_token') continue

            resp[fld] = decodeURI(req.body[fld])
        }

        cb(null, resp)
    }

    TestApi.postRaw = function (req, res, cb) {
        let resp = {
            "receivedAtServer": moment().valueOf()
        }

        for (let fld in req.body) {
            resp[fld] = req.body[fld]
        }

        cb(null, resp)
    }

    TestApi.delete = function (req, cb) {
        let resp = {
            "receivedAtServer": moment().valueOf()
        }

        for (let id in req.query) {
            if (id === 'access_token') continue

            resp[id] = req.query[id]
        }

        cb(null, resp)
    }
}
