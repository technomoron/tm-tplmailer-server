import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

interface env_option {
	description: string;
	options?: string[];
	default?: string | number;
	required?: true | false;
	type?: 'string' | 'number' | 'boolean' | 'strings'; // Default 'string'
}

interface api_key {
	keyid: string;
	uid: number;
	domain: number;
}

const env_options: { [key: string]: env_option } = {
	NODE_ENV: {
		description: 'Specifies the environment in which the app is running',
		options: ['development', 'production', 'staging'],
		default: 'development',
	},
	API_PORT: {
		description: 'Defines the port on which the app listens. Default 3780',
		default: '3198',
		type: 'number',
	},
	API_HOST: {
		description: 'Sets the local IP address for the API to listen at',
		default: '0.0.0.0',
	},
	API_URL: {
		description: 'Sets the public URL for the API (i.e. https://ml.example.com:3790)',
		required: true,
	},
	SWAGGER_ENABLE: {
		description: 'Enable Swagger API docs',
		default: 'false',
		type: 'boolean',
	},
	SWAGGER_PATH: {
		description: 'Path for swagger api docs',
		default: '/api-docs',
	},
	JWT_SECRET: {
		description: 'Secret key for generating JWT access tokens',
		required: true,
	},
	JWT_REFRESH: {
		description: 'Secret key for generating JWT refresh tokens',
		required: true,
	},
	API_DBUSER: {
		description: 'Database username for API database',
	},
	API_DBPASS: {
		description: 'Password for API database',
	},
	API_DBNAME: {
		description: 'Name of API database. Filename for sqlite3, database name for others',
		default: 'maildata',
	},
	API_DBHOST: {
		description: 'Host of API database',
		default: 'localhost',
	},
	API_DBTYPE: {
		description: 'Database type of WP database',
		options: ['sqlite'],
		default: 'sqlite',
	},
	API_DBLOG: {
		description: 'Log SQL statements',
		default: 'false',
		type: 'boolean',
	},
	SMTP_HOST: {
		description: 'Hostname of SMTP sending host',
		default: 'localhost',
	},
	SMTP_PORT: {
		description: 'SMTP host server port',
		default: 25,
		type: 'number',
	},
	SMTP_SECURE: {
		description: 'Use secure connection to SMTP host (SSL/TSL)',
		default: 'false',
		type: 'boolean',
	},
	SMTP_TLS_REJECT: {
		description: 'Reject bad cert/TLS connection to SMTP host',
		default: 'false',
		type: 'boolean',
	},
	SMTP_USER: {
		description: 'Username for SMTP host',
		default: '',
	},
	SMTP_PASSWORD: {
		description: 'Password for SMTP host',
		default: '',
	},
};

export function get_safe_env(name: string): any {
	if (!env_options[name]) {
		throw new Error(`Attempt to get non-existing environment var ${name}`);
	}
}

export function generate_env_dist() {
	const lines: string[] = [];
	const p = path.resolve(_dirname, '../../', '.env-dist');

	Object.entries(env_options).forEach(([key, option]) => {
		const opt = `${option.type || 'string'}${option.required ? ' - required' : ''}`;
		lines.push(`# ${option.description} [${opt}]`);
		if (option.options) {
			lines.push(`# Possible values: ${option.options.join(', ')}`);
		}
		if (option.required) {
			lines.push(`${key}=`);
		} else if (option.default !== undefined) {
			lines.push(`# ${key}=${option.default}`);
		} else {
			lines.push(`${key}=`);
		}
		lines.push('');
	});
	fs.writeFileSync(p, lines.join('\n'), 'utf8');
	console.log(`.env-dist file has been created at ${p}`);
}

function parse_boolean(value: string) {
	const truthyValues = ['true', '1', 'yes', 'on'];
	const falsyValues = ['false', '0', 'no', 'off'];
	if (truthyValues.includes(value?.toLowerCase())) return true;
	if (falsyValues.includes(value?.toLowerCase())) return false;
	return Boolean(value);
}

export function get_api_keys(): Record<string, api_key> {
	const keyPaths = [
		path.resolve(_dirname, '.api-keys.json'),
		path.resolve(_dirname, '../.api-keys.json'),
		path.resolve(_dirname, '../../.api-keys.json'),
	];
	for (const p of keyPaths) {
		if (fs.existsSync(p)) {
			const raw = fs.readFileSync(p, 'utf-8');
			const jsonData = JSON.parse(raw);
			console.log(`API Key Database loaded from ${p}`);
			return jsonData;
		}
	}
	console.log('No .api-keys file found');
	return {};
}

export function get_sane_env(env: { [key: string]: string | undefined }) {
	const validated_env: { [key: string]: string | number | boolean | string[] } = {};
	const errors: string[] = [];

	let envLoaded = false;
	const envPaths = [
		path.resolve(_dirname, '.env'),
		path.resolve(_dirname, '../.env'),
		path.resolve(_dirname, '../../.env'),
	];

	for (const envPath of envPaths) {
		if (fs.existsSync(envPath)) {
			dotenv.config({ path: envPath });
			console.log(`Loaded .env from ${envPath}`);
			envLoaded = true;
		}
	}
	if (!envLoaded) {
		throw new Error('No .env file found in specified directories');
	}

	Object.entries(env_options).forEach(([key, option]) => {
		const val = env[key];
		if (option.required && !val) {
			errors.push(`Missing required environment variable: ${key}`);
			return;
		}
		if (!val && option.default !== undefined) {
			validated_env[key] = option.default;
			return;
		}
		if (option.options && val && !option.options.includes(val)) {
			errors.push(`Invalid value for ${key}: ${val}. Must be one of: ${option.options.join(', ')}`);
			return;
		}
		let numValue = 0;
		if (val) {
			switch (option.type) {
				case 'boolean':
					validated_env[key] = parse_boolean(val);
					break;
				case 'number':
					numValue = Number(val);
					if (isNaN(numValue)) {
						errors.push(`Invalid number for ${key}: ${val}`);
					} else {
						validated_env[key] = numValue;
					}
					break;
				case 'strings':
					validated_env[key] = val.split(',').map((str) => str.trim());
					break;
				default: // 'string' or unspecified
					validated_env[key] = val;
					break;
			}
		}
	});
	if (errors.length > 0) {
		throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
	}

	// console.log(JSON.stringify(validated_env, undefined, 2));

	return validated_env;
}
