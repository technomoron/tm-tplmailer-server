import { Request, Response } from 'express';

import { api_domain } from './models/domain';
import { api_user } from './models/user';

export type KeyedHash<T> = { [key: string]: T };
