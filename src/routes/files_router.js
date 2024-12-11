const { Router } = require('express');
const filesController = require('../controllers/files-controller.js');

const router = Router();

const CREATE_DIR_ENDPOINT = '/create';
const UPLOAD_FILE_ENDPOINT = '/upload';

const rebaseUrlsOnParentFile = (req, res, next) => {
  const endpointRegex = new RegExp(
    `(${CREATE_DIR_ENDPOINT}|${UPLOAD_FILE_ENDPOINT})$`
  );
  const parentUrl = req.originalUrl.replace(endpointRegex, '');
  res.locals.createDirUrl = `${parentUrl}${CREATE_DIR_ENDPOINT}`;
  res.locals.uploadFileUrl = `${parentUrl}${UPLOAD_FILE_ENDPOINT}`;
  next();
};

router.use(rebaseUrlsOnParentFile);

router.get('/', filesController.getRootFiles);

router
  .route(`(/:id)?${CREATE_DIR_ENDPOINT}`)
  .get(filesController.getCreateDir)
  .post(filesController.postCreateDir);

router.get('/:id', filesController.getFile);

module.exports = { CREATE_DIR_ENDPOINT, UPLOAD_FILE_ENDPOINT, router };
