import { Application } from 'express';

import { storage } from './store/store';

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swagger_options = {
	definition: {
		openapi: '3.0.0',
		info: {
			title: 'MJML Mail Pusher',
			version: '1.0.0',
			description: `
This service is a template-based REST mailer daemon designed for handling emails efficiently.
        
## Features
 - Create and update email templates in MJML format, using nunjuks.
 - Validate recipient email addresses.
 - Send bulk emails using pre-defined templates with support for variables and locale-based content.
        
## Use Cases
 - Transactional emails (e.g., password resets, notifications).
 - Marketing campaigns with dynamic content and placeholders.
       
For more detailed usage and setup instructions, check the endpoints or external documentation.
`,
		},
		components: {
			securitySchemes: {
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
					bearerFormat: 'Opaque',
				},
			},
		},
	},
	apis: ['./src/types.ts', './src/api/*.ts'],
};

export function add_swagger_ui(app: Application) {
	if (storage.swagger_enable && storage.swagger_path) {
		const specs = swaggerJsdoc(swagger_options);
		app.use(storage.swagger_path, swaggerUi.serve, swaggerUi.setup(specs));
	}
}
