const express = require('express');
// const session = require('express-session');
// const mongoose = require('mongoose');
// const MongoStore = require('connect-mongo')(session);
// const passport = require('passport');
const promisify = require('es6-promisify');
const expressValidator = require('express-validator');
const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression');
const router = require('./routes');
const errorHandlers = require('./handlers/errors');
require('dotenv').config();
// require('./handlers/passport');

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

/*
// Start up Mongoose
mongoose.connect(process.env.DATABASE);
mongoose.Promise = global.Promise; // Tell Mongoose to use ES6 promises
mongoose.connection.on('error', (err) => {
  console.error(`Mongoose error: ${err.message}`);
});
*/

const app = express();
let server;

app.use(compression({ level: 9, threshold: 0 }));
app.use(cors({
  origin: `${process.env.CORS_ORIGIN || '*'}`,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: 'Accept, Origin, Content-Type, Referer',
  credentials: true,
}));

app.use(express.static('public'));
app.set('view engine', 'pug');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(expressValidator());

/*
app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({ mongooseConnection: mongoose.connection }),
}));

app.use(passport.initialize());
app.use(passport.session());
*/

// pass variables to our templates + all requests
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.currentPath = req.path;
  next();
});

// promisify some callback based APIs
/* app.use((req, res, next) => {
  req.login = promisify(req.login, req);
  next();
}); */

// Log all requests
app.use((req, res, next) => {
  console.info(`${req.method} ${req.url} ${req.body ? JSON.stringify(req.body) : 'No body'}`);
  next();
});

app.use(router);

// Handle errors
app.use(errorHandlers.notFound);
if (process.env.NODE_ENV === 'development') app.use(errorHandlers.developmentErrors);
app.use(errorHandlers.productionErrors);


const runServer = (port = process.env.PORT || 4000) =>
  new Promise((resolve) => {
    server = app.listen(port, () => {
      console.log(`Server now listening on port ${port}`);
      resolve();
    });
  });

const closeServer = () =>
  new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      resolve();
    });
  });

if (require.main === module) {
  runServer().catch(err => console.error(err));
}

module.exports = { app, runServer, closeServer };
