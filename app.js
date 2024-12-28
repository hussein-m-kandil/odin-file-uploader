const path = require('node:path');
const express = require('express');
const authenticate = require('./src/auth/authenticate.js');
const middlewares = require('./src/middlewares/middlewares.js');
const userRouter = require('./src/routes/user-router.js');
const shareRouter = require('./src/routes/share_router.js');
const filesRouter = require('./src/routes/files_router.js');

const PUBLIC_DIR = path.join(__dirname, 'public');
const VIEWS_DIR = path.join(__dirname, 'src/views');

const app = express();

app.set('views', VIEWS_DIR);
app.set('view engine', 'ejs');

authenticate(app);

app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));
app.use(middlewares.logReq);
app.use(middlewares.injectUrlIntoLocals);
app.use(middlewares.injectUserIntoLocals);
app.use(middlewares.initFlashInSession);
app.use(middlewares.injectErrorFlashIntoResLocals);

const SHARE_ENDPOINT = '/share';
const FILES_ENDPOINT = '/files';
const USER_ENDPOINT = '/user';

const verifyUserAuthentication = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.redirect(USER_ENDPOINT);
};

app.all('/', (req, res) => res.redirect(FILES_ENDPOINT));

app.use(SHARE_ENDPOINT, shareRouter);
app.use(USER_ENDPOINT, userRouter);
app.use(verifyUserAuthentication);
app.use(FILES_ENDPOINT, filesRouter);
app.use(middlewares.handleAppErrors);

if (!process.env.SERVERLESS_FUNCTION) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Running on port ${PORT}`));
}

module.exports = app;
