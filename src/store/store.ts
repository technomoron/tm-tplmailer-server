import { createTransport } from 'nodemailer';
import { Sequelize, Dialect } from 'sequelize';
import sp from 'synchronized-promise';

import { connect_api_db } from '../models/db';
import { Server, extapiRequest } from '../server';

import { get_sane_env, generate_env_dist, get_safe_env, get_api_keys } from './envloader';
import { TemplateStorage } from './templatecache';

/*
type DomainMapId = Record<number, api_domain_type>;
type TemplateMap = Record<string, api_template_type>;

interface TemplateStore {
    [domain_id: number]: {
        userid: number;
        deflocale: string;
        domain: api_domain_type;
        templates: TemplateMap;
    };
};
*/

export class mystorage {
	server: Server | null = null;

	is_production: boolean = false;
	is_staging: boolean = false;
	is_development: boolean = false;

	api_url: string;
	api_host: string;
	api_port: number;

	cur_api_req: extapiRequest | null;

	swagger_enable: boolean;
	swagger_path: string;

	api_dbuser: string;
	api_dbpass: string;
	api_dbname: string;
	api_dbhost: string;
	api_dbtype: Dialect;
	api_dblog: boolean;
	api_db!: Sequelize;

	jwt_secret: string;
	jwt_refresh: string;

	smtp_host: string;
	smtp_port: number;
	smtp_secure: boolean;
	smtp_tls_reject: boolean;
	smtp_user: string;
	smtp_password: string;

	keys: Record<string, any>;
	mailer: any;

	templatecache: TemplateStorage;

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

		this.cur_api_req = null;

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

		this.templatecache = new TemplateStorage();

		this.mailer = this.create_mail_transport();
	}

	private create_mail_transport() {
		const args: any = {
			host: this.smtp_host,
			port: this.smtp_port, /// 25, // 465, // 587,
			secure: this.smtp_secure,
			tls: {
				rejectUnauthorized: this.smtp_tls_reject,
			},
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

const storage: mystorage = new mystorage();

const initializeDatabases = async () => {
	[storage.api_db] = await Promise.all([connect_api_db()]);
};
sp(initializeDatabases)();

const preloadData = async () => {
	await Promise.all([storage.templatecache.preload_templates()]);
};
sp(preloadData)();

export { storage };
