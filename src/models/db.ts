import { Sequelize } from 'sequelize';

import { storage } from '../store/store'; // -typescript';

import { init_api_domain, api_domain } from './domain';
import { init_api_template, api_template } from './template';
import { init_api_user, api_user } from './user';

const fs = require('fs');
const path = require('path');

async function generateHash(password: string): Promise<string> {
	const bcrypt = require('bcryptjs');
	const salt = bcrypt.genSaltSync(10);
	const hash = bcrypt.hashSync(password, salt);
	return hash;
}

async function upsert_data() {
	try {
		const filePath = path.join(__dirname, '../../.init-data.json');

		if (fs.existsSync(filePath)) {
			const data = await fs.promises.readFile(filePath, 'utf8');
			const records = JSON.parse(data);
			if (records.user) {
				for (const record of records.user) {
					if (record.password) {
						record.password = await generateHash('vemmelig!32');
					}
					await api_user.upsert(record);
				}
			}
			if (records.domain) {
				for (const record of records.domain) {
					await api_domain.upsert(record);
				}
			}
			console.log('Data upserted successfully.');
		}
	} catch (error) {
		console.error('Error during sync and upsert:', error);
	}
}

export async function init_api_db(db: Sequelize) {
	await init_api_user(db);
	await init_api_domain(db);
	await init_api_template(db);

	api_user.hasMany(api_domain, {
		foreignKey: 'user_id',
		sourceKey: 'user_id',
		as: 'domains',
	});

	api_user.hasMany(api_template, {
		foreignKey: 'user_id',
		sourceKey: 'user_id',
		as: 'templates',
	});

	api_domain.belongsTo(api_user, {
		foreignKey: 'user_id',
		targetKey: 'user_id',
		as: 'user',
	});

	api_domain.hasMany(api_template, {
		foreignKey: 'domain_id',
		sourceKey: 'domain_id',
		as: 'templates',
	});

	api_template.belongsTo(api_user, {
		foreignKey: 'user_id',
		targetKey: 'user_id',
		as: 'user',
	});

	api_template.belongsTo(api_domain, {
		foreignKey: 'domain_id',
		targetKey: 'domain_id',
		as: 'domain',
	});

	await db.sync({ alter: true, force: true });
	upsert_data();
	console.log('API Database Initialized...');
}

export async function connect_api_db(): Promise<Sequelize> {
	try {
		const dbparams: any = {
			logging: storage.api_dblog,
			dialect: storage.api_dbtype,
			dialectOptions: {
				charset: 'utf8mb4',
			},
			define: {
				charset: 'utf8mb4',
				collate: 'utf8mb4_unicode_ci',
			},
		};
		if (storage.api_dbtype === 'sqlite') {
			dbparams.storage = storage.api_dbname + '.db';
		} else {
			dbparams.host = storage.api_dbhost;
			dbparams.database = storage.api_dbname;
			dbparams.username = storage.api_dbuser;
			dbparams.password = storage.api_dbpass;
		}
		const db = new Sequelize(dbparams);
		if (storage.api_dbtype === 'sqlite') {
			await db.query('PRAGMA foreign_keys = ON');
		}
		await db.authenticate();
		console.log('API Database Connected');
		await init_api_db(db);
		return db;
	} catch (e: any) {
		console.log(e?.error || e?.message || e);
		process.exit(1);
	}
}
