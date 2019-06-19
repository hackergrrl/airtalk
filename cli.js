#!/usr/bin/env node

var record = require('node-record-lpcm16')
var readline = require('readline')
var makeSwarm = require('discovery-swarm')
var getport = require('random-port')
var Speaker = require('speaker')
var through = require('through2')

if (process.argv.length !== 3) {
  console.log('USAGE: airtalk <ROOM-NAME>')
  process.exit(1)
}

var speakStart = 0
var room = process.argv[2]
var name = 'comrade ' + Number(Math.random().toString().substring(2)).toString(16)
var peers = {}

// get name
setTimeout(function () {
  process.stdout.write('nickname: ')
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });
  rl.once('line', function (nick) {
    if (nick && nick.length) name = nick
    start()
  })
}, 500)

// start chat
function start () {
  var swarm = makeSwarm()
  swarm.id = Buffer.concat([swarm.id, Buffer.from(name)])
  swarm.join('airchat_' + room)
  getport(function (port) {
    console.log('joined swarm')
    swarm.listen(port)
  })

  var input = record
    .start({
      sampleRateHertz: 16000,
      threshold: 0,
      verbose: false,
      recordProgram: 'arecord',
      silence: '1.0',
    })
  input.on('data', function (){})

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
}
