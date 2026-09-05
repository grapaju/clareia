const NodeEnv = {
	Development: 'development',
	Production: 'production',
};

const BodyLimit = 1024 * 1024 * 20;

const MaterialUpload = {
	MaxSizeMB: 25,
	AllowedMimeTypes: [
		'application/pdf',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.ms-excel',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'application/vnd.ms-powerpoint',
		'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		'text/plain',
		'text/csv',
		'image/png',
		'image/jpeg',
		'application/zip',
		'application/x-zip-compressed',
	],
};

export { NodeEnv, BodyLimit, MaterialUpload };
