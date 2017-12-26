const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('ranking.db')

var url = require('url')
var express = require('express')
var app = express()
var bodyParser = require('body-parser')
var sockets = {}

app.set('view engine', 'pug')
app.use(express.static('public'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ 
  extended: true
}))

app.get('/', (req, res) => {
  getTopCities((err, result) => {
    res.render('index', {
      cities: result
    })
  })
})

app.get('/admin', (req,res, next) => {

  if(req.query.pass != 'password123')
    return next()

  getAll((err, result) => {
    if(!err)
      res.render('admin', {all: result})
  })

})

app.get('/:city', (req, res) => {
  var city = req.params.city.toLowerCase()
  getTop(city, (err, localTop) => {
    if(!err)

    getGlobalTop((err, globalTop) => {
      if(!err)

      res.render('city', {
        globalTop: globalTop,
        city: city
      })

    })
  })

  var q = `INSERT INTO visitors (city) VALUES (?)`
  db.run(q, [city])
})


app.get('/api/top/:city', (req, res) => {
  getTop(req.params.city.toLowerCase(), (err, result) => {
    if(!err)
      res.json(result)
  })
})

app.get('/api/global/top', (req, res) => {
  getGlobalTop((err, result) => {
    if(!err)
      res.json(result)
  })
})

app.post('/api/vote', (req, res) => {
  if(!validateName(req.body.name))
    return res.json([])

  var q = `INSERT INTO votes (name, city) VALUES (?, ?)`
  var city = req.body.city.toLowerCase()
  var name = toTitleCase(req.body.name)
  db.run(q, [name, city], () => {

    getVoteCount(city, (err, result) => {
      if(!err) citycast(city, 'votes', result.count)
    })

    getUserCount(city, (err, result) => {
      if(!err) citycast(city, 'users', result.count)
    })
  
  })

  res.json({})

})
app.post('/api/disapprove', (req, res) => {
  if(req.query.pass != 'password123')
    return res.end()

  var q = `UPDATE votes SET approved = 1 WHERE name = ?`
  db.run(q, [req.body.name], () => {
  })
})

app.post('/api/search', (req, res) => {
  if(!validateName(req.body.name))
    return res.json([])

  var name = toTitleCase(req.body.name)
  var city = req.body.city.toLowerCase()


  var q = `INSERT INTO searches (name, city) VALUES (?, ?)`
  db.run(q, [name, city], () => {
    getSearchCount(city, (err, result) => {
      if(!err) citycast(city, 'searches', result.count)
    })
  })


  var q = `
  SELECT 
    (SELECT count(*) FROM votes WHERE name = $name AND city = $city) AS votes,
    count(*) AS searches, date FROM searches WHERE city = $city AND name = $name`
  db.get(q, {
    $city: city, 
    $name: name
  }, (err, result) => {
    if(err){
      console.error(err)
      return
    }
    res.json(result)

  })
})

app.get('/api/events/:city', (req, res) => {
  var city = req.params.city.toLowerCase()

  req.socket.setTimeout(0)

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  if(!sockets[city])
    sockets[city] = new Set()

  sockets[city].add(res)

  req.on('close', () => {
    sockets[city].delete(res)
  })


  getVoteCount(city, (err, result) => {
    if(!err)
      res.write(`event: votes\ndata: ${result.count}\n\n`)
  })

  getUserCount(city, (err, result) => {
    if(!err) 
      res.write(`event: users\ndata: ${result.count}\n\n`)
  })

  getSearchCount(city, (err, result) => {
    if(!err)
      res.write(`event: searches\ndata: ${result.count}\n\n`)
  })

  getVistorCount(city, (err, result) => {
    if(!err) citycast(city, 'visitors', result.count)
  })

})

app.listen(3000, () => {
  console.log('app listening on port 3000!')
})

setInterval(() =>{
  broadcast('ping', 1)
}, 10000)

function validateName(name){
  if(name.length < 1 || name.length > 20)
    return false

  var regex = new RegExp("^[A-Za-zäÄöÖüÜß ]+ [A-Za-zäÄöÖüÜß]{1}$", 'i')
  if(!name.match(regex))
    return false

  return true
}

function citycast(city, eventName, data){
  if(!sockets[city])
    return

  sockets[city].forEach(socket => {
    socket.write(`event: ${eventName}\ndata: ${data}\n\n`)
  })
}

function broadcast(eventName, data){
  Object.keys(sockets).forEach(city => {
    sockets[city].forEach(socket => {
      socket.write(`event: ${eventName}\ndata: ${data}\n\n`)
    })
  })
}

function toTitleCase(str){
  return str.replace(/\w\S*/g, txt => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  })
}

function getVoteCount(city, cb){
  var q = `SELECT count(*) as count FROM votes WHERE city = ?`
  db.get(q, [city], cb)
}

function getSearchCount(city, cb){
  var q = `SELECT count(*) as count FROM searches WHERE city = ?`
  db.get(q, [city],cb)
}

function getUserCount(city, cb){
  var q = `SELECT count(distinct(name)) as count FROM votes WHERE city = ?`
  db.get(q, [city], cb)
}

function getVistorCount(city, cb){
  var q = `SELECT count(*) as count FROM visitors WHERE city = ?`
  db.get(q, [city], cb)
}

function getTop(city, cb){
  var city = city.toLowerCase()
  var q = `
    SELECT count(*) AS count, name FROM votes 
    WHERE city = ? AND approved = 0
    GROUP BY name ORDER BY count DESC limit 20`
  db.all(q, [city], cb)
}

function getTopCities(cb){
  var q = `
    SELECT count(*) AS count, city as name FROM votes 
    WHERE approved = 0
    GROUP BY city ORDER BY count DESC limit 50`
  db.all(q, cb)
}

function getGlobalTop(cb){
  var q = `
    SELECT count(*) AS count, name, city FROM votes WHERE approved = 0 
    GROUP BY name,city ORDER BY count DESC LIMIT 10`
  db.all(q, cb)
}

function getAll(cb){
  var q = `SELECT distinct(name) FROM votes WHERE approved = 0`
  db.all(q, cb)
}
