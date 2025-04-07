import MailerAPI from './api/mailer';
import { apiRequest, apiServer, apiError, apiAuthClass } from './lib/api-server';
import { api_domain } from './models/domain';
import { api_user } from './models/user';
import { storage } from './store/store';

export interface extapiRequest extends apiRequest {
	user?: api_user;
	domain?: api_domain;
	locale?: string;
}

export class Server extends apiServer {
	override async get_api_key(key: string): Promise<any | null> {
		console.log(`Looking up api key  ${key}`);
		const user = await api_user.findOne({ where: { token: key } });
		return user ? { uid: user.user_id } : null;
	}

	override async authorize(apireq: extapiRequest, requiredClass: apiAuthClass) {
		const { domain, locale } = apireq.req.body;
		if (!domain) {
			throw new apiError({ code: 401, error: 'Missing domain' });
		}
		const user = await api_user.findOne({ where: { token: apireq.token } });
		if (!user) {
			throw new apiError({ code: 401, error: `Invalid/Unknown API Key/Token '${apireq.token}'` });
		}
		const dbdomain = await api_domain.findOne({ where: { domain } });
		if (!dbdomain) {
			throw new apiError({ code: 500, error: `Unable to look up the domain '${domain}'` });
		}
		apireq.domain = dbdomain;
		apireq.locale = locale || 'en';
		apireq.user = user;
	}
}

storage.server = new Server({
	api_host: storage.api_host,
	api_port: storage.api_port,
	jwt_secret: storage.jwt_secret,
});
new MailerAPI().init(storage.server);
storage.server.start();
