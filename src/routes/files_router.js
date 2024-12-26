const { Router } = require('express');
const filesController = require('../controllers/files-controller.js');

const router = Router();

const ENDPOINTS = {
  SHARE: '/share',
  CREATE: '/create',
  UPLOAD: '/upload',
  DELETE: '/delete',
  RENAME: '/rename',
  DOWNLOAD: '/download',
};

const injectBaseUrl = (req, res, next) => {
  res.locals.baseUrl = req.baseUrl;
  next();
};

const injectCreateAndUploadUrls = (req, res, next) => {
  const currentEndpoint = `/${req.originalUrl.split('/').at(-1)}`;
  if (!Object.values(ENDPOINTS).includes(currentEndpoint)) {
    res.locals.createUrl = `${req.originalUrl}${ENDPOINTS.CREATE}`;
    res.locals.uploadUrl = `${req.originalUrl}${ENDPOINTS.UPLOAD}`;
  }
  next();
};

router.use(injectBaseUrl);
router.use(injectCreateAndUploadUrls);

router.get('/', filesController.getRootFiles);

router
  .route(`(/:id)?${ENDPOINTS.SHARE}`)
  .get(filesController.getShare)
  .post(filesController.postShare);

router
  .route(`(/:id)?${ENDPOINTS.UPLOAD}`)
  .get(filesController.getUpload)
  .post(filesController.postUpload);

router
  .route(`(/:id)?${ENDPOINTS.CREATE}`)
  .get(filesController.getCreate)
  .post(filesController.postCreate);

router
  .route(`(/:id)?${ENDPOINTS.RENAME}`)
  .get(filesController.getRename)
  .post(filesController.postRename);

router
  .route(`(/:id)?${ENDPOINTS.DELETE}`)
  .get(filesController.getDelete)
  .post(filesController.postDelete);

router.route(`(/:id)?${ENDPOINTS.DOWNLOAD}`).get(filesController.getDownload);

router.get('/:id', filesController.getFile);

module.exports = router;
