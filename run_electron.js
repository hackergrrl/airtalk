var electron = require('electron')
var app = electron.app
var BrowserWindow = electron.BrowserWindow

var path = require('path')
var url = require('url')

var mainWindow

var args = require('minimist')(process.argv)

var opts = {}
opts.name = args._[0]
opts.room = args._[1]
opts.interactive = true

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 640,
    height: 480,
    autoHideMenuBar: true,
    show: !!opts.interactive
  })

  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  mainWindow.webContents.once('did-finish-load', function () {
    console.log('ok')
    mainWindow.webContents.send('start', opts)
  })

  mainWindow.on('closed', function () {
    app.quit()
  })
}

electron.ipcMain.on('done', function () {
  app.quit()
})

electron.ipcMain.on('console.log', function (_, args) {
  console.log.apply(console.log, args)
})

app.on('ready', createWindow)
