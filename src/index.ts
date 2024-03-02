import { HTMLElement, Node, TextNode } from 'node-html-parser';

import { env } from '@/env';
import {
	notion,
	BlockObjectRequestV,
	RichTextItemRequest,
	filterBlockObjects,
} from './notion';
import { filterHTMLElements, filterTextNodes, getSection } from './htmlParser';

const parseTextNode = (node: TextNode): RichTextItemRequest => ({
	type: 'text',
	text: { content: node.text },
});

let pageTitle = 'TEMPORARY PAGE TITLE';
const parseHtmlElement = (element: HTMLElement): BlockObjectRequestV | null => {
	switch (element.tagName) {
		case 'H1':
			if (pageTitle !== 'TEMPORARY PAGE TITLE')
				throw new Error('Multiple H1 elements found');
			pageTitle = element.text;
		case 'H2':
			if (element.text === '') {
				return null;
			}
			return {
				heading_1: {
					rich_text: element.childNodes
						.filter(filterTextNodes)
						.map(parseTextNode),
				},
			};
		case 'H3':
			return {
				heading_2: {
					rich_text: element.childNodes
						.filter(filterTextNodes)
						.map(parseTextNode),
				},
			};
		case 'H4':
			return {
				heading_3: {
					rich_text: element.childNodes
						.filter(filterTextNodes)
						.map(parseTextNode),
				},
			};
		case 'H5':
			return {
				paragraph: {
					rich_text: element.childNodes
						.filter(filterTextNodes)
						.map(parseTextNode)
						.map((item) => ({
							...item,
							annotations: { underline: true },
						})),
				},
			};
		case 'P':
			return {
				paragraph: {
					rich_text: element.childNodes
						.filter(filterTextNodes)
						.map(parseTextNode),
				},
			};
		case 'UL':
		case 'DIV':
		case 'ASIDE':
		case 'FIGURE':
		case 'SELECT':
		case 'A':
			// console.log('Discarded element', element.outerHTML);
			return null;
		default:
			throw new Error(`Unknown element: ${element.tagName}`);
	}
};

const parseNode = (
	element: Node,
): BlockObjectRequestV | RichTextItemRequest | null => {
	if (element instanceof HTMLElement) {
		return parseHtmlElement(element);
	}
	if (element instanceof TextNode) {
		return parseTextNode(element);
	}
	throw new Error('All nodes should be either HTMLElements or TextNodes.');
};

const contents = getSection()
	.childNodes.map(parseNode)
	.filter(Boolean)
	.filter(filterBlockObjects);

const page = await notion.pages.create({
	parent: { type: 'page_id', page_id: env.ROOT_PAGE_ID },
	properties: {
		title: { title: [{ type: 'text', text: { content: pageTitle } }] },
	},
	children: contents.slice(0, 100),
});
for (let i = 100; i < contents.length; i += 100) {
	await notion.blocks.children.append({
		block_id: page.id,
		children: contents.slice(i, i + 100),
	});
}
