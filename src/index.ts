import { formAPI } from './api/forms.js';
import { mailerAPI } from './api/mailer.js';
import { mailApiServer } from './server.js';
import { store } from './store/store.js';

const server = new mailApiServer(
	{
		api_host: store.api_host,
		api_port: store.api_port,
		jwt_secret: store.jwt_secret,
		upload_path: 'uploads/',
	},
	store
)
	.api(mailerAPI)
	.api(formAPI);

server.start();
