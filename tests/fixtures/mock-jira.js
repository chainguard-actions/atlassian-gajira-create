// Minimal mock of the Jira REST endpoints used by gajira-create.
// Usage: node mock-jira.js <port> <logdir>
// Every request is appended as a JSON line to <logdir>/requests.log.
const http = require('http')
const fs = require('fs')
const path = require('path')
const { URL } = require('url')

const port = parseInt(process.argv[2] || '8089', 10)
const logDir = process.argv[3] || '/tmp/mock-jira'
fs.mkdirSync(logDir, { recursive: true })
const logFile = path.join(logDir, 'requests.log')

function send (res, status, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(body)
}

const server = http.createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => { raw += c })
  req.on('end', () => {
    const u = new URL(req.url, `http://127.0.0.1:${port}`)
    let body = null
    try { body = raw ? JSON.parse(raw) : null } catch (e) { body = raw }
    fs.appendFileSync(logFile, JSON.stringify({
      method: req.method,
      path: u.pathname,
      query: Object.fromEntries(u.searchParams.entries()),
      authorization: req.headers.authorization || '',
      body,
    }) + '\n')

    if (u.pathname === '/health') return send(res, 200, { ok: true })

    if (req.method === 'GET' && u.pathname === '/rest/api/2/issue/createmeta') {
      const projectKey = u.searchParams.get('projectKeys')
      const issuetype = u.searchParams.get('issuetypeNames')
      if (projectKey === 'NOPE') return send(res, 200, { projects: [] })
      const issuetypes = issuetype === 'Missing' ? [] : [{ name: issuetype, fields: {} }]
      return send(res, 200, { projects: [{ key: projectKey, issuetypes }] })
    }

    if (req.method === 'POST' && u.pathname === '/rest/api/2/issue') {
      const projectKey = body && body.fields && body.fields.project && body.fields.project.key
      if (projectKey === 'ERR') {
        return send(res, 400, { errorMessages: [], errors: { summary: 'boom' } })
      }
      return send(res, 201, { id: '10001', key: `${projectKey}-123`, self: 'http://mock/10001' })
    }

    send(res, 404, { errorMessages: ['not found'] })
  })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`mock jira listening on ${port}`)
})
