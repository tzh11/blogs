const Worker = require("web-worker")

var worker = new Worker('worker.js')
worker.onmessage = event => {
  console.log(event.data)
}
worker.postMessage('Nicholas')