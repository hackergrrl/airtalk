#!/usr/bin/env node

var record = require('getusermedia')
var makeSwarm = require('discovery-swarm')
var Speaker = require('speaker')
var through = require('through2')
var swarmDefaults = require('dat-swarm-defaults')
var ipc = require('electron').ipcRenderer
// var adapter = require('webrtc-adapter');

console.log = function () {
  var args = Array.prototype.slice.call(arguments)
  ipc.send('console.log', args)
}

module.exports = function (opts) {
  var room = opts.room
  var name = opts.name
  var opts = Object.assign({}, swarmDefaults())
  var swarm = makeSwarm(opts)
  swarm.id = Buffer.concat([swarm.id, Buffer.from(name)])

  record({audio:true,video:false}, function (err, input) {
    if (err) return console.log('ERR', err.message)

    console.log(3, JSON.stringify(input))

    input.resume()

    console.log('joined swarm')
    console.log('--- hold the L key to speak ---')
    console.log('---      CTRL+C to quit     ---')

    swarm.join('airchat_' + room)

    var speaker = new Speaker({
      channels: 1,
      bitDepth: 16,
      sampleRate: 16000
    })
    speaker.on('error', console.error)

    var buf = Buffer.alloc(0)
    var bufferer = through(function (chunk, enc, next) {
      buf = Buffer.concat([buf, chunk])
      if (buf.length > 16000) {
        this.push(buf)
        buf = Buffer.alloc(0)
      }
      next()
    })

    bufferer.pipe(speaker)

    swarm.on('connection', function (conn, info) {
      console.log(info.id.length)
      var id = info.id.slice(0, 32)
      var name = info.id.slice(32).toString()
      conn.name = name
      peers[id] = conn
      console.log(name, 'connected')

      conn.pipe(bufferer)

      conn.once('end', function () {
        console.log(name, 'disconnected')
        delete peers[id]
      })
      conn.once('error', function (err) {
        console.log(name, 'errored out')
        delete peers[id]
      })
    })

    process.stdin.setRawMode(true)
    process.stdin.on('data', function (data) {
      if (data.toString('hex') === '03') {
        process.stdin.setRawMode(false)
        process.exit(0)
      }
      
      if (data.toString('hex') === '6c') {
        if (!speakStart) {
          console.log('speak start')
          speakStart = new Date().getTime()
          Object.keys(peers).forEach(function (key) {
            var conn = peers[key]
            input.pipe(conn)
          })
        } else {
          speakStart = new Date().getTime()
        }
      }
    })

    setInterval(function () {
      if (speakStart && new Date().getTime() - speakStart > 800) {
        speakStart = false
        console.log('speak end')
        Object.keys(peers).forEach(function (key) {
          var conn = peers[key]
          input.unpipe(conn)
          input.on('data', function (){})
        })
      }
    }, 100)
  })
}

ipc.on('start', function (_, opts) {
  module.exports(opts)
})
