self.onmessage = event => {
  self.postMessage('Hello,' + event.data + '!')
}