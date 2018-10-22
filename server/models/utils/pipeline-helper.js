'use strict'

const app = require('../../server')

var PipelineHelper = function () {}

PipelineHelper.prototype.getCallbackToken = function (callback) {
    const ApiUser = app.models.ApiUser
    const AccessToken = app.models.AccessToken
    ApiUser.findOne({ "where": { "username" : process.env.CALLBACK_USERNAME}}, (err, user) => {
        AccessToken.findOne({ "where": { "userId" : user.id }}, (err, existing) => {
            if (err || !existing) {
                ApiUser.login({ "username": process.env.CALLBACK_USERNAME, "password": process.env.CALLBACK_PASSWORD}, (err, token) => {
                    if (err) return callback(err)
                    callback(null, token.id)
                })
            } else {
                let expiry = ((new Date()) - (new Date(existing.created)) - existing.ttl)
                // If we have less than 10 minutes left before the token expire, then create a new one.
                if (expiry < 600) {
                    ApiUser.login({ "username": process.env.CALLBACK_USERNAME, "password": process.env.CALLBACK_PASSWORD}, (err, token) => {
                        if (err) return callback(err)
                        callback(null, token.id)
                    })            
                } else {
                    callback(null, existing.id)
                }    
            }
        })    
    })    
}

module.exports = new PipelineHelper()