
require('./config/environment');

var createError = require('http-errors');
var express = require('express');
var fs = require('fs');
const path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const mongoose = require("mongoose");
const userRouter = require('./routes/userRoute');
const adminRouter = require('./routes/adminRoute');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');

var app = express();

// ================= CORS CONFIGURATION =================

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
  'http://localhost:5173',
  'https://w7rmnnqg-5173.inc1.devtunnels.ms'
]
  .flatMap((value) => String(value || '').split(','))
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => {
    try {
      return new URL(value).origin;
    } catch (error) {
      console.error('Invalid CORS origin:', value);
      return null;
    }
  })
  .filter(Boolean);

console.log('Allowed CORS Origins:', allowedOrigins);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log('Blocked CORS origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization'
  ],
  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS'
  ]
}));

// ================= MIDDLEWARE =================

app.use(logger('dev'));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// ================= SITEMAP =================

app.get('/sitemap.xml', async (req, res, next) => {
  try {
    const sitemapPath = path.join(__dirname, 'public', 'sitemap.xml');

    const sitemap = await fs.promises.readFile(
      sitemapPath,
      'utf8'
    );

    const frontendOrigin = (
      process.env.FRONTEND_URL || 'http://localhost:5173'
    ).replace(/\/+$/, '');

    const dynamicSitemap = sitemap.replace(
      /<loc>(.*?)<\/loc>/g,
      (_match, location) => {
        const pathOrUrl = new URL(
          location,
          `${frontendOrigin}/`
        ).pathname;

        return `<loc>${frontendOrigin}${pathOrUrl}</loc>`;
      }
    );

    res.type('application/xml').send(dynamicSitemap);

  } catch (error) {
    next(error);
  }
});

// ================= STATIC FILES =================

app.use(express.static(path.join(__dirname, 'public')));

const reactBuild = path.join(
  __dirname,
  '..',
  'Beauty-care-frontend',
  'build'
);

app.use(express.static(reactBuild, { index: false }));

app.use((req, res, next) => {
  if (
    req.method === 'GET' &&
    (req.headers.accept || '').includes('text/html') &&
    !req.path.startsWith('/admin')
  ) {
    return res.sendFile(
      path.join(reactBuild, 'index.html'),
      (err) => {
        if (err) next();
      }
    );
  }

  next();
});

// ================= SESSION =================

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

// ================= ROUTES =================

app.use('/', userRouter);
app.use('/admin', adminRouter);

// ================= 404 ERROR =================

app.use(function (req, res, next) {
  next(createError(404));
});

// ================= ERROR HANDLER =================

app.use(function (err, req, res, next) {
  res.status(err.status || 500).json({
    status: false,
    message: err.message || 'Internal server error'
  });
});

// ================= MONGODB CONNECTION =================

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

module.exports = app;
