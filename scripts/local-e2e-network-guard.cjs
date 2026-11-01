// Loaded only by the local e2e app process. Fail closed before any non-loopback connection.
const net = require('node:net')
const original = net.Socket.prototype.connect
net.Socket.prototype.connect = function (...args) {
  const normalized = Array.isArray(args[0]) ? args[0][0] : net._normalizeArgs(args)[0]
  if (!normalized.path && !['127.0.0.1', 'localhost', '::1'].includes(normalized.host || 'localhost')) {
    throw new Error('Local e2e blocks external network connections')
  }
  return original.apply(this, args)
}
