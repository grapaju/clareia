import multer from 'multer';

export const uploadFiles = ({
	maxCount = 5,
	maxSizeMB = 20,
	allowedMimeTypes,
	fieldName,
}) => {
	const upload = multer({
		storage: multer.memoryStorage(),
		limits: {
			fileSize: maxSizeMB * 1024 * 1024,
		},
		fileFilter: (req, file, cb) => {
			if (allowedMimeTypes.includes(file.mimetype) || file.mimetype === 'application/octet-stream') {
				cb(null, true);
			} else {
				cb(new Error(`Invalid file type. Only ${allowedMimeTypes.join(', ')} are allowed.`));
			}
		},
	});

	return upload.array(fieldName, maxCount);
};

export const uploadSingleFile = ({ maxSizeMB, allowedMimeTypes, fieldName }) => {
	const upload = multer({
		storage: multer.memoryStorage(),
		limits: {
			files: 1,
			fileSize: maxSizeMB * 1024 * 1024,
		},
		fileFilter: (req, file, cb) => {
			if (allowedMimeTypes.includes(file.mimetype)) {
				cb(null, true);
				return;
			}

			const error = new Error('Tipo de arquivo nao permitido.');
			error.status = 415;
			cb(error);
		},
	});

	const handler = upload.single(fieldName);
	return (req, res, next) => handler(req, res, (error) => {
		if (error?.code === 'LIMIT_FILE_SIZE') {
			error.status = 413;
			error.message = `Este arquivo e maior que o limite permitido de ${maxSizeMB} MB.`;
		}
		next(error);
	});
};
