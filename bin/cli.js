#!/usr/bin/env node

var fs = require('fs')
var path = require('path')
var spawn = require('child_process').spawn
var args = require('minimist')(process.argv)

if (args.h || args.help) return printUsage()
if (process.argv.length !== 4) return printUsage()

var name = process.argv[2]
var room = process.argv[3]

if (!name || !room) return printUsage()

var file = path.join(__dirname, '..', 'run_electron.js')
var pargs = [file].concat(process.argv.slice(2))
var p = spawn('electron', pargs)
p.on('exit', console.error)
p.stdout.pipe(process.stdout)
p.stderr.pipe(process.stderr)

function printUsage () {
  fs.createReadStream(path.join(__dirname, 'usage.txt')).pipe(process.stdout)
}
