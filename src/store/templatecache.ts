import * as nunjucks from 'nunjucks';

import { api_domain, api_domain_type } from '../models/domain';
import { api_template, api_template_type } from '../models/template';
import { extapiRequest } from '../server';

import { storage } from './store';

type DomainMapId = Record<number, api_domain_type>;
type TemplateMap = Record<string, api_template_type>;

interface TemplateStore {
	[domain_id: number]: {
		userid: number;
		deflocale: string;
		domain: api_domain_type;
		templates: TemplateMap;
	};
}

export class TemplateStorage {
	templates: TemplateStore = {};
	domainmap: DomainMapId = {};
	templatemap: TemplateMap = {};
	nunjucks: nunjucks.Environment;

	constructor() {
		this.nunjucks = new nunjucks.Environment(new SequelizeLoader(), { autoescape: true });
	}

	getSender(apireq: extapiRequest, tpl: api_template): string {
		if (tpl.sender) {
			return tpl.sender;
		}
		if (apireq.domain!.sender) {
			return apireq.domain!.sender;
		}
		return `${apireq.user!.name} <${apireq.user!.email}>`;
	}

	async getTemplate(apireq: extapiRequest, name: string, locale: string): Promise<api_template> {
		if (!locale) {
			locale = apireq.domain!.deflocale;
			if (!locale) {
				locale = apireq.user!.deflocale;
			}
			if (!locale) {
				locale = '';
			}
		}
		const tpl = await api_template.findOne({
			where: {
				user_id: apireq.user!.user_id,
				domain_id: apireq.domain!.domain_id,
				locale,
				name,
			},
		});
		if (!tpl) {
			throw new Error(
				`Unable to locate template, tried name=${name}; domain=${apireq.domain!.domain_id}; locale=${locale}`
			);
		}
		if (!tpl.sender) {
			tpl.sender = this.getSender(apireq, tpl);
		}
		return tpl;
	}

	print_cache() {
		console.log(
			'DATA LOGGED',
			JSON.stringify(
				{
					domains: this.domainmap,
					templates: this.templatemap,
				},
				undefined,
				2
			)
		);
	}

	upsertTemplate(template: api_template_type): void {
		const domain = this.domainmap[template.domain_id];
		if (!domain) {
			// storage.print_cache();
			throw new Error(`Domain with ID ${template.domain_id} not found.`);
		}
		let tstore = this.templates[template.domain_id];
		if (!tstore) {
			tstore = this.templates[template.domain_id] = {
				userid: domain.user_id,
				deflocale: domain.deflocale,
				domain,
				templates: {},
			};
		}
		tstore.templates[template.slug] = template;
	}

	async preload_templates() {
		const domains = await api_domain.findAll();
		domains.forEach((domain) => {
			this.domainmap[domain.domain_id] = domain;
		});
		const templates = await api_template.findAll();
		templates.forEach((template) => {
			this.upsertTemplate(template);
		});
	}
}

class SequelizeLoader extends nunjucks.Loader implements nunjucks.ILoader {
	getSource(name: string): nunjucks.LoaderSource {
		name = name.replace(/\.njk$/, '');
		const ar = storage.server?.curreq as extapiRequest;
		if (!ar) {
			throw new Error('There is no global api req');
		}
		const { user, domain, locale } = ar;
		const tstore = storage.templatecache.templates[domain!.domain_id];
		if (!tstore) {
			throw new Error(`No templates found for domain "${domain?.domain}".`);
		}
		const templates = tstore.templates;

		const slugsToSearch = [
			`${locale}-${name}`.toLowerCase(),
			`${tstore.deflocale}-${name}`.toLowerCase(),
			`${name}`.toLowerCase(),
		];

		for (const slug of slugsToSearch) {
			if (templates[slug]) {
				const res = {
					src: templates[slug].template,
					path: name,
					noCache: true,
				};
				return res;
			}
		}
		throw new Error(
			`Template "${name}" not found for any locale in domain "${domain!.domain}". Searched slugs: ${slugsToSearch.join(', ')}`
		);
	}
}
