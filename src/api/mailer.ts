import emailAddresses, { ParsedMailbox } from 'email-addresses';
import { convert } from 'html-to-text';
import nunjucks from 'nunjucks';
import { apiModule, apiRoute, apiError } from 'tm-api-server';

import { api_domain } from '../models/domain.js';
import { api_template } from '../models/template.js';
import { api_user } from '../models/user.js';
import { mailApiServer } from '../server.js';
import { mailApiRequest } from '../types.js';

export class mailerAPI extends apiModule<mailApiServer> {
	//
	// Validate and return the parsed email address
	//

	validateEmail(email: string): string | null {
		const parsed = emailAddresses.parseOneAddress(email);
		if (parsed) {
			return (parsed as ParsedMailbox).address;
		}
		return null;
	}

	//
	// Validate a set of email addresses. Return arrays of invalid
	// and valid email addresses.
	//

	validateEmails(list: string): { valid: string[]; invalid: string[] } {
		const valid = [] as string[],
			invalid = [] as string[];

		const emails = list
			.split(',')
			.map((email) => email.trim())
			.filter((email) => email !== '');
		emails.forEach((email) => {
			const addr = this.validateEmail(email);
			if (addr) {
				valid.push(addr);
			} else {
				invalid.push(email);
			}
		});
		return { valid, invalid };
	}

	async assert_domain_and_user(apireq: mailApiRequest) {
		const { domain, locale } = apireq.req.body;
		if (!domain) {
			throw new apiError({ code: 401, message: 'Missing domain' });
		}
		const user = await api_user.findOne({ where: { token: apireq.token } });
		if (!user) {
			throw new apiError({ code: 401, message: `Invalid/Unknown API Key/Token '${apireq.token}'` });
		}
		const dbdomain = await api_domain.findOne({ where: { domain } });
		if (!dbdomain) {
			throw new apiError({ code: 401, message: `Unable to look up the domain '${domain}'` });
		}
		apireq.domain = dbdomain;
		apireq.locale = locale || 'en';
		apireq.user = user;
	}

	// Store a template in the database

	private async post_template(apireq: mailApiRequest): Promise<[number, any]> {
		this.assert_domain_and_user(apireq);

		const { template, sender = '', name, subject = '', locale = '' } = apireq.req.body;

		if (!template) {
			throw new apiError({ code: 400, message: 'Missing template data' });
		}
		if (!name) {
			throw new apiError({ code: 400, message: 'Missing template name' });
		}

		const data = {
			user_id: apireq.user!.user_id,
			domain_id: apireq.domain!.domain_id,
			name,
			subject,
			locale,
			sender,
			template,
		};

		/*
		console.log(JSON.stringify({
		user: apireq.user,
		domain: apireq.domain,
		domain_id: apireq.domain.domain_id,
		data
		}, undefined, 2)); */

		try {
			const [tpl, created] = await api_template.upsert(data, {
				returning: true,
			});
			console.log('Template upserted:', name, 'Created:', created);
		} catch (error: any) {
			throw new apiError({
				code: 500,
				message: this.server!.guess_exception_text(error, 'Unknown Sequelize Error on upsert template'),
			});
		}
		return [200, { Status: 'OK' }];
	}

	// Send a template using posted arguments.

	private async post_send(apireq: mailApiRequest): Promise<[number, any]> {
		this.assert_domain_and_user(apireq);

		const { name, rcpt, user, domain = '', locale = '', vars = {} } = apireq.req.body;

		if (!name || !rcpt || !domain) {
			throw new apiError({ code: 400, message: 'name/rcpt/domain required' });
		}

		// const dbdomain = await api_domain.findOne({ where: { domain } });

		const { valid, invalid } = this.validateEmails(rcpt);
		if (invalid.length > 0) {
			throw new apiError({ code: 400, message: 'Invalid email address(es): ' + invalid.join(',') });
		}
		let template: api_template | null;
		const deflocale = apireq.server.store.deflocale || '';

		try {
			const domain_id = apireq.domain!.domain_id;
			template =
				(await api_template.findOne({ where: { name, domain_id, locale } })) ||
				(await api_template.findOne({ where: { name, domain_id, locale: deflocale } })) ||
				(await api_template.findOne({ where: { name, domain_id } }));
			if (!template) {
				throw new apiError({
					code: 404,
					message: `Template "${name}" not found for any locale in domain "${domain}"`,
				});
			}
		} catch (e: any) {
			throw new apiError({
				code: 500,
				message: this.server!.guess_exception_text(e, 'Unknown Sequelize Error'),
			});
		}

		const sender = template.sender || apireq.domain!.sender || apireq.user!.email;
		if (!sender) {
			throw new apiError({ code: 500, message: `Unable to locate sender for ${template.name}` });
		}
		try {
			const env = new nunjucks.Environment(null, { autoescape: false });

			for (const recipient of valid) {
				const fullargs = { ...vars, _rcpt_email_: recipient };
				const prehtml = await env.renderString(template.template, fullargs);
				const html = prehtml.replace('%recipient_email%', recipient);
				const textContent = convert(html);
				const sendargs = {
					from: sender,
					to: recipient,
					subject: 'My Subject',
					html,
					text: textContent,
				};
				await apireq.server.storage.mailer.sendMail(sendargs);
			}
			return [200, { Status: 'OK', Message: 'Emails sent successfully' }];
		} catch (e: any) {
			// console.log(JSON.stringify(e, null, 2));
			throw new apiError({ code: 500, message: e });
		}
	}

	override define_routes(): apiRoute[] {
		return [
			{ method: 'post', path: '/send', handler: this.post_send.bind(this), auth: { type: 'yes', req: 'any' } },
			{
				method: 'post',
				path: '/template',
				handler: this.post_template.bind(this),
				auth: { type: 'yes', req: 'any' },
			},
		];
	}
}

export default mailerAPI;
