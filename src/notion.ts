import { Client } from '@notionhq/client';
import { env } from './env';
import { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';

export const notion = new Client({
	auth: env.NOTION_SECRET,
});
export type RichTextItemRequest = NonNullable<
	NonNullable<Extract<BlockObjectRequest, { embed: any }>['embed']>['caption']
>[number];

export type BlockObjectRequestV = Exclude<
	BlockObjectRequest,
	| { synced_block: any }
	| { children: { synced_block: any } | { column: any } | { column_list: any } }
>;
export const filterBlockObjects = (
	object: RichTextItemRequest | BlockObjectRequestV,
): object is BlockObjectRequestV => object.type !== 'text';
