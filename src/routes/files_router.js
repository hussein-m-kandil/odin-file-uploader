const { Router } = require('express');
const filesController = require('../controllers/files-controller.js');

const router = Router();

const CRUD_ENDPOINTS = {
  CREATE: '/create',
  UPLOAD: '/upload',
  DELETE: '/delete',
  RENAME: '/rename',
};

const injectBaseUrl = (req, res, next) => {
  res.locals.baseUrl = req.baseUrl;
  next();
};

const injectCreateAndUploadUrls = (req, res, next) => {
  const currentEndpoint = `/${req.originalUrl.split('/').at(-1)}`;
  if (!Object.values(CRUD_ENDPOINTS).includes(currentEndpoint)) {
    res.locals.createUrl = `${req.originalUrl}${CRUD_ENDPOINTS.CREATE}`;
    res.locals.uploadUrl = `${req.originalUrl}${CRUD_ENDPOINTS.UPLOAD}`;
  }
  next();
};

router.use(injectBaseUrl);
router.use(injectCreateAndUploadUrls);

router.get('/', filesController.getRootFiles);

router
  .route(`(/:id)?${CRUD_ENDPOINTS.CREATE}`)
  .get(filesController.getCreate)
  .post(filesController.postCreate);

router
  .route(`(/:id)?${CRUD_ENDPOINTS.RENAME}`)
  .get(filesController.getRename)
  .post(filesController.postRename);

router
  .route(`(/:id)?${CRUD_ENDPOINTS.DELETE}`)
  .get(filesController.getDelete)
  .post(filesController.postDelete);

router.get('/:id', filesController.getFile);

module.exports = router;
