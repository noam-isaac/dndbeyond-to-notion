import * as dotenv from 'dotenv';
dotenv.config();

import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
	server: {
		NOTION_SECRET: z.string(),
		ROOT_PAGE_ID: z.string(),
	},
	client: {},
	clientPrefix: 'NEXT_PUBLIC_',
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
