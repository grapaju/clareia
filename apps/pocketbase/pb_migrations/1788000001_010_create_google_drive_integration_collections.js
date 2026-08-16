/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
	const connectionCollection = new Collection({
		"id": "pbc_1788000001",
		"name": "googleDriveConnections",
		"type": "base",
		"system": false,
		"listRule": "userId = @request.auth.id",
		"viewRule": "userId = @request.auth.id",
		"createRule": "@request.auth.id != ''",
		"updateRule": "userId = @request.auth.id",
		"deleteRule": "userId = @request.auth.id",
		"fields": [
			{
				"autogeneratePattern": "[a-z0-9]{15}",
				"hidden": false,
				"id": "text1788000001",
				"max": 15,
				"min": 15,
				"name": "id",
				"pattern": "^[a-z0-9]+$",
				"presentable": false,
				"primaryKey": true,
				"required": true,
				"system": true,
				"type": "text"
			},
			{
				"autogeneratePattern": "",
				"hidden": false,
				"id": "text1788000002",
				"max": 0,
				"min": 0,
				"name": "userId",
				"pattern": "",
				"presentable": false,
				"primaryKey": false,
				"required": true,
				"system": false,
				"type": "text"
			},
			{
				"autogeneratePattern": "",
				"hidden": false,
				"id": "text1788000003",
				"max": 0,
				"min": 0,
				"name": "email",
				"pattern": "",
				"presentable": false,
				"primaryKey": false,
				"required": false,
				"system": false,
				"type": "text"
			},
			{
				"autogeneratePattern": "",
				"hidden": true,
				"id": "text1788000004",
				"max": 0,
				"min": 0,
				"name": "encryptedRefreshToken",
				"pattern": "",
				"presentable": false,
				"primaryKey": false,
				"required": true,
				"system": false,
				"type": "text"
			},
			{
				"autogeneratePattern": "",
				"hidden": false,
				"id": "text1788000005",
				"max": 0,
				"min": 0,
				"name": "scope",
				"pattern": "",
				"presentable": false,
				"primaryKey": false,
				"required": false,
				"system": false,
				"type": "text"
			},
			{
				"autogeneratePattern": "",
				"hidden": false,
				"id": "text1788000006",
				"max": 0,
				"min": 0,
				"name": "status",
				"pattern": "",
				"presentable": false,
				"primaryKey": false,
				"required": false,
				"system": false,
				"type": "text"
			},
			{
				"max": "",
				"min": "",
				"hidden": false,
				"id": "date1788000007",
				"name": "connectedAt",
				"presentable": false,
				"primaryKey": false,
				"required": false,
				"system": false,
				"type": "date"
			},
			{
				"hidden": false,
				"id": "autodate1788000008",
				"name": "created",
				"onCreate": true,
				"onUpdate": false,
				"presentable": false,
				"system": false,
				"type": "autodate"
			},
			{
				"hidden": false,
				"id": "autodate1788000009",
				"name": "updated",
				"onCreate": true,
				"onUpdate": true,
				"presentable": false,
				"system": false,
				"type": "autodate"
			}
		],
		"indexes": [
			"CREATE UNIQUE INDEX idx_google_drive_connections_user ON googleDriveConnections (userId)"
		]
	});

	const projectCollection = new Collection({
		"id": "pbc_1788000002",
		"name": "googleDriveProjectFolders",
		"type": "base",
		"system": false,
		"listRule": "userId = @request.auth.id",
		"viewRule": "userId = @request.auth.id",
		"createRule": "@request.auth.id != ''",
		"updateRule": "userId = @request.auth.id",
		"deleteRule": "userId = @request.auth.id",
		"fields": [
			{
				"autogeneratePattern": "[a-z0-9]{15}",
				"hidden": false,
				"id": "text1788000101",
				"max": 15,
				"min": 15,
				"name": "id",
				"pattern": "^[a-z0-9]+$",
				"presentable": false,
				"primaryKey": true,
				"required": true,
				"system": true,
				"type": "text"
			},
			{
				"autogeneratePattern": "",
				"hidden": false,
				"id": "text1788000102",
				"max": 0,
				"min": 0,
				"name": "userId",
				"pattern": "",
				"presentable": false,
				"primaryKey": false,
				"required": true,
				"system": false,
				"type": "text"
			},
			{
				"autogeneratePattern": "",
				"hidden": false,
				"id": "text1788000103",
				"max": 0,
				"min": 0,
				"name": "projectId",
				"pattern": "",
				"presentable": false,
				"primaryKey": false,
				"required": true,
				"system": false,
				"type": "text"
			},
			{
				"autogeneratePattern": "",
				"hidden": false,
				"id": "text1788000104",
				"max": 0,
				"min": 0,
				"name": "projectName",
				"pattern": "",
				"presentable": false,
				"primaryKey": false,
				"required": true,
				"system": false,
				"type": "text"
			},
			{
				"autogeneratePattern": "",
				"hidden": false,
				"id": "text1788000105",
				"max": 0,
				"min": 0,
				"name": "projectType",
				"pattern": "",
				"presentable": false,
				"primaryKey": false,
				"required": false,
				"system": false,
				"type": "text"
			},
			{
				"autogeneratePattern": "",
				"hidden": false,
				"id": "text1788000106",
				"max": 0,
				"min": 0,
				"name": "rootFolderId",
				"pattern": "",
				"presentable": false,
				"primaryKey": false,
				"required": true,
				"system": false,
				"type": "text"
			},
			{
				"autogeneratePattern": "",
				"hidden": false,
				"id": "text1788000107",
				"max": 0,
				"min": 0,
				"name": "rootFolderUrl",
				"pattern": "",
				"presentable": false,
				"primaryKey": false,
				"required": true,
				"system": false,
				"type": "text"
			},
			{
				"autogeneratePattern": "",
				"hidden": false,
				"id": "text1788000108",
				"max": 0,
				"min": 0,
				"name": "subfoldersJson",
				"pattern": "",
				"presentable": false,
				"primaryKey": false,
				"required": false,
				"system": false,
				"type": "text"
			},
			{
				"max": "",
				"min": "",
				"hidden": false,
				"id": "date1788000109",
				"name": "lastSyncedAt",
				"presentable": false,
				"primaryKey": false,
				"required": false,
				"system": false,
				"type": "date"
			},
			{
				"hidden": false,
				"id": "autodate1788000110",
				"name": "created",
				"onCreate": true,
				"onUpdate": false,
				"presentable": false,
				"system": false,
				"type": "autodate"
			},
			{
				"hidden": false,
				"id": "autodate1788000111",
				"name": "updated",
				"onCreate": true,
				"onUpdate": true,
				"presentable": false,
				"system": false,
				"type": "autodate"
			}
		],
		"indexes": [
			"CREATE UNIQUE INDEX idx_google_drive_project_user_project ON googleDriveProjectFolders (userId, projectId)"
		]
	});

	try {
		app.save(connectionCollection);
		app.save(projectCollection);
		return;
	} catch (e) {
		if (e.message.includes("Collection name must be unique")) {
			console.log("Google Drive collections already exist, skipping");
			return;
		}
		throw e;
	}
}, (app) => {
	const revertIfExists = (nameOrId) => {
		try {
			const collection = app.findCollectionByNameOrId(nameOrId);
			app.delete(collection);
		} catch (e) {
			if (e.message.includes("no rows in result set")) {
				console.log(`Collection ${nameOrId} not found, skipping revert`);
				return;
			}
			throw e;
		}
	};

	revertIfExists("pbc_1788000002");
	revertIfExists("pbc_1788000001");
})