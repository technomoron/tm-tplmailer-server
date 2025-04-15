import { createTransport } from 'nodemailer';
import { Sequelize, Dialect } from 'sequelize';

import { connect_api_db } from '../models/db.js';
import { ImailStore } from '../types.js';

import { get_sane_env, generate_env_dist, get_api_keys } from './envloader.js';

export class mailStore implements ImailStore {
	is_production = false;
	is_staging = false;
	is_development = false;
	swagger_enable = false;
	swagger_path = '';

	api_url = '';
	api_host = '0.0.0.0';
	api_port = 3780;
	api_dbuser = '';
	api_dbpass = '';
	api_dbname = '';
	api_dbhost = '';
	api_dbtype: Dialect = 'sqlite';
	api_dblog = false;
	api_db: Sequelize | null = null;

	jwt_secret = '';
	jwt_refresh: string;

	smtp_host = '';
	smtp_port = 25;
	smtp_secure = false;
	smtp_tls_reject = false;
	smtp_user = '';
	smtp_password = '';

	keys: Record<string, any>;
	mailer: any;

	constructor() {
		generate_env_dist();

		const saneenv = get_sane_env(process.env);

		if (saneenv.NODE_ENV === 'production') {
			this.is_production = true;
		} else if (saneenv.NODE_ENV === 'staging') {
			this.is_staging = true;
		} else if (saneenv.NODE_ENVAPI === 'development') {
			this.is_development = true;
		} else {
			this.is_development = true;
		}

		this.api_port = Number(saneenv.API_PORT) || 3780;
		this.api_host = String(saneenv.API_HOST) || '0.0.0.0';
		this.api_url = String(saneenv.API_URL);

		this.swagger_enable = Boolean(saneenv.SWAGGER_ENABLE) || false;
		this.swagger_path = String(saneenv.SWAGGER_PATH) || '/api-docs';

		this.jwt_secret = String(saneenv.JWT_SECRET);
		this.jwt_refresh = String(saneenv.JWT_REFRESH);

		this.api_dbuser = String(saneenv.API_DBUSER);
		this.api_dbpass = String(saneenv.API_DBPASS);
		this.api_dbname = String(saneenv.API_DBNAME);
		this.api_dbhost = String(saneenv.API_DBHOST) || 'localhost';
		this.api_dbtype = (String(saneenv.API_DBTYPE) as Dialect) || 'mysql';
		this.api_dblog = !!saneenv.API_DBLOG;

		this.smtp_host = String(saneenv.SMTP_HOST);
		this.smtp_port = Number(saneenv.SMTP_PORT);
		this.smtp_secure = Boolean(saneenv.SMTP_SECURE);
		this.smtp_tls_reject = Boolean(saneenv.SMTP_TLS_REJECT);
		this.smtp_user = String(saneenv.SMTP_USER);
		this.smtp_password = String(saneenv.SMTP_PASSWORD);

		this.keys = get_api_keys();

		this.mailer = this.create_mail_transport();
	}

	async init(): Promise<this> {
		try {
			// await this.templatecache.preload_templates();
			this.api_db = await connect_api_db(this);
		} catch (err) {
			console.error('Error during initialization:', err);
			throw err;
		}
		return this;
	}

	private create_mail_transport() {
		const args: any = {
			host: this.smtp_host,
			port: this.smtp_port, /// 25, // 465, // 587,
			secure: this.smtp_secure,
			tls: {
				rejectUnauthorized: this.smtp_tls_reject,
			},
			// logger: true,
			// debug: true,
		};
		const user = this.smtp_user;
		const pass = this.smtp_password;
		if (user && pass) {
			args.auth = { user, pass };
		}
		console.log(JSON.stringify(args, undefined, 2));

		const mailer = createTransport(args);
		if (!mailer) {
			throw new Error('Unable to create mailer');
		}
		return mailer;
	}

	public get_api_key(key: string): Record<string, any> {
		return this.keys[key] || null;
	}
}

const store: mailStore = await new mailStore().init();

export { store };
