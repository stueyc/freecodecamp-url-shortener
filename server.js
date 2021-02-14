require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const dns = require('dns')
const mongoose = require('mongoose')

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());

app.use('/public', express.static(`${process.cwd()}/public`));
app.use(express.urlencoded({extended: false}))

const urlSchema = new mongoose.Schema({
  original_url: { 
    type: String,
    required: true
  },
  short_url: { 
    type: Number,
    required: true
  }
})

const Url = mongoose.model('Url', urlSchema)

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

app.post('/api/shorturl/new', function(req, res) {
  let reqUrl
  let protocolRegex = /^https?:$/i
  try {
    reqUrl = new URL(req.body.url)
    let protocol = reqUrl.protocol
    if (!protocolRegex.test(protocol)) throw new Error('Invalid protocol')
  }
  catch (error) {
    console.log(error)
    res.send({ error: 'invalid url' })
    return
  }
    
  dns.lookup(reqUrl.hostname, function(err) {
    if (err) return res.send({ error: 'invalid url' })
    Url.findOne({ original_url: reqUrl.toString()}, function(err, dbUrl) {
      if (err) {
        console.log(err)
        return res.json({ error: 'database error' })
      }

      //if the url exists in the database then we just return the stored short_url
      if (dbUrl) {
        res.send({ original_url: dbUrl.original_url, short_url: dbUrl.short_url })
      }

      //if the url was not found then we need to add a new short_url to the database
      if (!dbUrl) {
        // check for the next number we can use for a short url, if DB is empty then use 1
        Url.find().sort('-short_url').limit(1).exec(function (error, result) {
          if (error) return console.log('error finding from db: ' + error)
          
          let nextShortUrl
          result[0] ? nextShortUrl = result[0].short_url + 1 : nextShortUrl = 1
          console.log('nextShortUrl: ' + nextShortUrl)
          const newUrl = new Url({
            original_url: reqUrl,
            short_url: nextShortUrl
          })
          newUrl.save(function(saveErr, saveResult) {
            if (saveErr) return console.log("error saving: " + saveErr)
            res.send({ original_url: saveResult.original_url, short_url: saveResult.short_url })
          })

        })
        
      }
    })
  })
})

app.get('/api/shorturl/:shortUrl', function(req, res) {
  Url.findOne({ short_url: req.params.shortUrl}, function(err, dbUrl) {
      console.log(req.params.shortUrl)
      if (err) {
        console.log(err)
        return res.json({ error: 'database error' })
      }
      // if the short url is in the database, redirect. Otherwise return 404
      if (dbUrl) return res.redirect(dbUrl.original_url)
      res.sendStatus(404)
  })
})



app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
