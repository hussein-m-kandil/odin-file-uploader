const { body, param, validationResult } = require('express-validator');
const { Prisma } = require('@prisma/client');
const { prismaClient } = require('../model/db.js');
const AppGenericError = require('../errors/app-generic-error.js');

const CREATE_TITLE = 'Create Folder';
const FORM_VIEW = 'file-form';
const MAX_LEN = 100;
const MIN_LEN = 1;
const FK_VIOLATION_CODE = 'P2003';
const UNIQUE_VIOLATION_CODE = 'P2002';
const PARENT_NOT_FOUND_ERR_MSG = 'Parent folder not found!';
const CREATE_ERR_MSG = "Couldn't create a folder! Try again later.";
const NAME_EXISTS_ERR_MSG = 'This name is already exists in the same folder!';

const generateFormValidators = () => {
  const validators = [
    body('name')
      .isLength({ min: MIN_LEN })
      .withMessage(`A name must contain at least ${MIN_LEN} letters`)
      .isLength({ max: MAX_LEN })
      .withMessage(`A name can contain at most ${MAX_LEN} letters`),
  ];
  validators.push((req, res, next) => {
    const validationErrors = validationResult(req);
    if (validationErrors.isEmpty()) return next();
    return res.render(FORM_VIEW, {
      validationErrors: validationErrors.mapped(),
    });
  });
  return validators;
};

const fileIdValidators = [
  param('id').optional().isUUID(),
  (req, res, next) => {
    if (validationResult(req).isEmpty()) return next();
    next(new AppGenericError('Invalid file!', 400));
  },
];

module.exports = {
  getRootFiles: [
    async (req, res, next) => {
      try {
        res.locals.files = await prismaClient.file.findMany({
          where: { parentId: null, ownerId: req.user.id },
        });
        next();
      } catch (e) {
        console.error(e);
        res.locals.error = 'Could not find any files!';
        res.statusCode = 500;
        next();
      }
    },
    (req, res) => {
      res.render('index', { title: `${req.user.username} files` });
    },
  ],

  getFile: [
    ...fileIdValidators,
    async (req, res, next) => {
      try {
        const ownerId = req.user.id;
        const file = await prismaClient.file.findUnique({
          where: { id: req.params.id, ownerId },
          include: { children: true, parent: true },
        });
        if (!file) {
          return next(new AppGenericError('File Not Found', 404));
        }
        // TODO: Use recursive query instead!
        // ** START TEMP SOLUTION **
        const parent = file.parent;
        if (parent) {
          res.locals.parents = [parent];
          let grandParentId = parent.parentId;
          while (grandParentId) {
            const grandParent = await prismaClient.file.findUnique({
              where: { id: grandParentId, ownerId },
            });
            res.locals.parents.push(grandParent);
            grandParentId = grandParent.parentId;
          }
        }
        // ** END TEMP SOLUTION **
        return res.render('index', {
          file,
          title: file.name,
          files: file.children,
        });
      } catch (e) {
        console.error(e);
        next(
          new AppGenericError("Couldn't get any files! Try again later!", 500)
        );
      }
    },
  ],

  getCreateDir: [
    ...fileIdValidators,
    async (req, res, next) => {
      res.locals.title = CREATE_TITLE;
      const ownerId = req.user.id;
      const parentId = req.params.id;
      if (parentId) {
        try {
          const parent = await prismaClient.file.findUnique({
            where: { id: parentId, ownerId },
          });
          if (!parent) {
            return next(new AppGenericError(PARENT_NOT_FOUND_ERR_MSG, 404));
          }
          return res.render(FORM_VIEW, { parent });
        } catch (e) {
          console.error(e);
          return next(new AppGenericError(CREATE_ERR_MSG, 500));
        }
      }
      res.render(FORM_VIEW);
    },
  ],

  postCreateDir: [
    ...fileIdValidators,
    (req, res, next) => {
      res.locals.title = CREATE_TITLE;
      res.locals.formData = req.body;
      next();
    },
    ...generateFormValidators(),
    async (req, res, next) => {
      try {
        const { name } = req.body;
        const ownerId = req.user.id;
        const parentId = req.params.id;
        if (!parentId) {
          /**
           * Assure that the given name does not exist within the NULL parent
           * because the unique constraint on the fields: (`file_name`, `parent_id`)'
           * won't sound if the parent is NULL which is always unique (i.d. NULL not equal NULL)!
           */
          const file = await prismaClient.file.findFirst({
            where: { name, ownerId, parentId: null },
          });
          if (file) {
            throw new Prisma.PrismaClientKnownRequestError(
              '\n\tUnique constraint failed on the fields: (`file_name`,`parent_id`)',
              {
                code: UNIQUE_VIOLATION_CODE,
                clientVersion: Prisma.prismaVersion.client,
                meta: { modelName: 'File', target: ['file_name', 'parent_id'] },
              }
            );
          }
        }
        await prismaClient.file.create({
          data: { typeDir: true, ownerId, parentId, name },
        });
        res.redirect(parentId ? `${req.baseUrl}/${parentId}` : req.baseUrl);
      } catch (e) {
        console.error(e);
        if (e.code === FK_VIOLATION_CODE) {
          next(new AppGenericError(PARENT_NOT_FOUND_ERR_MSG, 404));
        } else if (e.code === UNIQUE_VIOLATION_CODE) {
          res.status(409).render(FORM_VIEW, { error: NAME_EXISTS_ERR_MSG });
        } else {
          res.status(500).render(FORM_VIEW, { error: CREATE_ERR_MSG });
        }
      }
    },
  ],
};
