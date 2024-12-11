const AppGenericError = require('../errors/app-generic-error.js');

module.exports = {
  handleAppErrors: (error, req, res, next) => {
    if (!(error instanceof AppGenericError)) {
      if (error.statusCode === 404 || error.status === 404) {
        error.name = 'Not Found';
        error.statusCode = 404;
        error.status = 404;
      }
      error.stack = '';
      return next(error);
    }
    req.session._appFlash = { error: error.message };
    res.redirect('/');
  },

  logReq: (req, res, next) => {
    console.log(`${req.method}: ${req.originalUrl}`);
    next();
  },

  injectUrlIntoLocals: (req, res, next) => {
    res.locals.url = req.originalUrl;
    next();
  },

  injectUserIntoLocals: (req, res, next) => {
    res.locals.user = req.user;
    next();
  },

  initFlashInSession: (req, res, next) => {
    if (!req.session._appFlash) {
      req.session._appFlash = {};
    }
    next();
  },

  injectErrorFlashIntoResLocals: (req, res, next) => {
    const error = req.session._appFlash.error;
    delete req.session._appFlash.error;
    if (error) {
      res.locals.error = error;
    }
    next();
  },
};
