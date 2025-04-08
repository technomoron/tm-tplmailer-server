import emailAddresses, { ParsedMailbox } from 'email-addresses';
import { convert } from 'html-to-text';
// import mjml2html from 'mjml';

// import { apiError, apiRoute, apiModule } from '../lib/api-server';
import { apiError, apiRoute, apiModule } from 'tm-api-server';
import { api_template } from '../models/template';
import { extapiRequest } from '../server';
import { storage } from '../store/store';

class MailerAPI extends apiModule {
	validateEmail(email: string): string | null {
		const parsed = emailAddresses.parseOneAddress(email);
		if (parsed) {
			return (parsed as ParsedMailbox).address;
		}
		return null;
	}

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

	private async postTemplate(apireq: extapiRequest): Promise<[number, any]> {
		const { template, sender = '', name, subject = '', locale = '' } = apireq.req.body;

		if (!template) {
			throw new apiError({ code: 400, error: 'Missing template data' });
		}
		if (!name) {
			throw new apiError({ code: 400, error: 'Missing template name' });
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

		try {
			const [tpl, created] = await api_template.upsert(data, {
				returning: true,
			});
			storage.templatecache.upsertTemplate(tpl);
			console.log('Template upserted:', name, 'Created:', created);
		} catch (error: any) {
			if (error.name === 'SequelizeValidationError') {
				console.error(
					'Validation Error:',
					error.errors.map((e: any) => e.message)
				);
			} else {
				console.error('Unexpected Error:', error);
			}
			throw error;
		}
		// storage.print_cache();
		return [200, { Status: 'OK' }];
	}

	private async postSend(apireq: extapiRequest): Promise<[number, any]> {
		const { name, rcpt, locale = '', vars = {} } = apireq.req.body;
		if (!name || !rcpt) {
			throw new apiError({ code: 400, error: 'Invalid request body' });
		}

		const { valid, invalid } = this.validateEmails(rcpt);
		if (invalid.length > 0) {
			throw new apiError({ code: 400, error: 'Invalid email address(es): ' + invalid.join(',') });
		}
		let tpl: api_template;
		try {
			tpl = await storage.templatecache.getTemplate(apireq, name, locale);
		} catch (e: any) {
			throw new apiError(e);
		}
		try {
			for (const recipient of valid) {
				const fullargs = { ...vars, _rcpt_email_: recipient };
				const mjml = await storage.templatecache.nunjucks.render(name, fullargs);
				const mjml2 = mjml.replace('%recipient_email%', recipient);
				const htmlOutput = mjml2; // mjml2html(mjml2);
				const textContent = convert(htmlOutput);
				const sendargs = {
					from: tpl.sender,
					to: recipient,
					subject: 'My Subject',
					html: htmlOutput,
					text: textContent,
				};
				await storage.mailer.sendMail(sendargs);
			}
			return [200, { Status: 'OK', Message: 'Emails sent successfully' }];
		} catch (e: any) {
			throw new Error(e);
		}
	}

	override define_routes(): apiRoute[] {
		return [
			{ method: 'post', path: '/send', handler: this.postSend.bind(this), auth: { type: 'yes', req: 'any' } },
			{
				method: 'post',
				path: '/template',
				handler: this.postTemplate.bind(this),
				auth: { type: 'yes', req: 'any' },
			},
		];
	}
}

export default MailerAPI;
