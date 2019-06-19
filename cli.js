#!/usr/bin/env node

var record = require('node-record-lpcm16')
var makeSwarm = require('discovery-swarm')
var Speaker = require('speaker')
var through = require('through2')
var os = require('os')
var spawn = require('child_process').spawnSync
var swarmDefaults = require('dat-swarm-defaults')

if (process.argv.length !== 4) {
  console.log('USAGE: airtalk <NICKNAME> <ROOM-NAME>')
  process.exit(1)
}

var p = spawn('sox')
if (p.error) {
  if (os.platform() === 'linux') {
    console.log('"sox" is required. Use your package manager to install something like:')
    console.log()
    console.log('sudo apt-get install sox libsox-fmt-all')
  } else if (os.platform() === 'darwin') {
    console.log('"sox" is required. Use your package manager to install something like:')
    console.log()
    console.log('brew install sox')
  } else if (os.platform() === 'win32') {
    console.log('"sox" is required. Install the binaries from:')
    console.log()
    console.log('http://sourceforge.net/projects/sox/files/latest/download')
  } else {
    console.log('The audio package "sox" is required.')
  }
  process.exit(1)
}

var speakStart = 0
var name = process.argv[2]
var room = process.argv[3]
var peers = {}

if (!name || !room) {
  console.log('USAGE: airtalk <NICKNAME> <ROOM-NAME>')
  process.exit(1)
}

start()

// start chat
function start () {
  var opts = Object.assign({}, swarmDefaults())
  var swarm = makeSwarm(opts)
  swarm.id = Buffer.concat([swarm.id, Buffer.from(name)])

  console.log('joined swarm')
  console.log('--- hold the L key to speak ---')
  console.log('---      CTRL+C to quit     ---')

  swarm.join('airchat_' + room)

  var input = record
    .start({
      sampleRateHertz: 16000,
      threshold: 0,
      verbose: false,
      recordProgram: 'sox',
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
