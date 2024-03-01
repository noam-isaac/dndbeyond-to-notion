import fs from 'fs';
import { parse } from 'node-html-parser';
import { Client } from '@notionhq/client';
import { env } from '@/env';
import { HTMLElement, Node, TextNode } from 'node-html-parser';
import { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';

const notion = new Client({
	auth: env.NOTION_SECRET,
});

const html = fs.readFileSync('index.html', 'utf8');
const parsedHtml = parse(html);
const section = parsedHtml
	?.querySelector('section.primary-content article')
	?.removeWhitespace();
if (!section) {
	throw new Error(
		'Could not find section.primary-content div.p-article-content',
	);
}

const parseHtmlElement = (element: Node): string | string[] => {
	if (element instanceof HTMLElement) {
		console.log(element.tagName);
		return element.childNodes
			.flatMap(parseHtmlElement)
			.map((parsedNode) => element.tagName + ' ' + parsedNode);
	}
	if (element instanceof TextNode) {
		return element.text;
	}
	throw new Error('All nodes should be either HTMLElements or TextNodes.');
};

const createdPage = await notion.pages.create({
	parent: {
		type: 'page_id',
		page_id: env.ROOT_PAGE_ID,
	},
	properties: {
		title: [{ type: 'text', text: { content: 'Title' } }],
		type: 'title',
	},
});
const contents = parseHtmlElement(section) as string[];

notion.blocks.children.append({
	block_id: createdPage.id,
	children: contents
		.map(
			(content): BlockObjectRequest => ({
				object: 'block',
				type: 'paragraph',
				paragraph: { rich_text: [{ type: 'text', text: { content } }] },
			}),
		)
		.slice(0, 10),
});
