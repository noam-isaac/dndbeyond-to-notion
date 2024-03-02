import { HTMLElement, Node } from 'node-html-parser';

import { env } from '@/env';
import { notion, BlockObjectRequestV, RichTextItemRequest } from './notion';
import { isHTMLElement, isTextNode, getSection } from './htmlParser';
import { text } from 'stream/consumers';

let pageTitle = 'TEMPORARY PAGE TITLE';

const parseHTMLElementTextualChildren = (element: HTMLElement) =>
	element.childNodes.flatMap(parseTextualChildNode).filter(Boolean);

const parseTextualChildNode = (element: Node): RichTextItemRequest[] => {
	if (isTextNode(element)) {
		return [
			{
				type: 'text',
				text: { content: element.text },
			},
		];
	}
	if (isHTMLElement(element)) {
		switch (element.tagName) {
			case 'P':
			case 'DIV':
				return parseHTMLElementTextualChildren(element);
			case 'STRONG':
				return parseHTMLElementTextualChildren(element).map((child) => ({
					...child,
					annotations: { ...child.annotations, bold: true },
				}));
			case 'EM':
				return parseHTMLElementTextualChildren(element).map((child) => ({
					...child,
					annotations: { ...child.annotations, italic: true },
				}));

			case 'A':
				const href = element.getAttribute('href');
				if (href === undefined) {
					throw new Error('A tag without href' + element.outerHTML);
				}
				const isUrlRelative = href?.startsWith('/');
				const url = isUrlRelative ? env.BASE_URL + href : href;
				if (url.startsWith('#')) return []; //TODO: handle internal links
				return [
					{
						type: 'text',
						text: {
							content: element.text,
							link: { url },
						},
					},
				];
			case 'BR':
				return [
					{
						type: 'text',
						text: {
							content: '\n',
						},
					},
				];
			case 'FIGURE': //TODO handle later
			case 'SELECT':
				return [];
			case 'H1':
			case 'H2':
			case 'H3':
			case 'H4':
			case 'H5':
			case 'UL':
			case 'ASIDE':
			case '':
				console.log(
					`Tag ${element.tagName} cannot be transformed into rich text. Full HTML: ${element.outerHTML.slice(0, 20)}`,
				);
			default:
				throw new Error(`Unknown element: ${element.tagName}`);
		}
	}
	throw new Error('Unknown node type' + element.toString());
};

const parseHTMLElement = (element: HTMLElement): BlockObjectRequestV[] => {
	switch (element.tagName) {
		case 'H1':
			if (pageTitle !== 'TEMPORARY PAGE TITLE')
				throw new Error('Multiple H1 elements found');
			pageTitle = element.text;
		case 'H2':
			return [
				{
					heading_1: {
						rich_text: parseHTMLElementTextualChildren(element),
					},
				},
			];
		case 'H3':
			return [
				{
					heading_2: {
						rich_text: parseHTMLElementTextualChildren(element),
					},
				},
			];
		case 'H4':
			return [
				{
					heading_3: {
						rich_text: parseHTMLElementTextualChildren(element),
					},
				},
			];
		case 'H5':
			return [
				{
					paragraph: {
						rich_text: parseHTMLElementTextualChildren(element).filter(
							(child) => ({
								...child,
								annotations: { ...child.annotations, underline: true },
							}),
						),
					},
				},
			];
		case 'P':
			return [
				{
					paragraph: {
						rich_text: parseHTMLElementTextualChildren(element),
					},
				},
			];
		case 'ASIDE':
			if (element.getAttribute('class')?.includes('text--quote-box')) {
				return [
					{
						quote: {
							rich_text: parseHTMLElementTextualChildren(element),
							color: 'pink_background',
						},
					},
				];
			}
			if (element.getAttribute('class')?.includes('epigraph')) {
				return [
					{
						quote: {
							rich_text: parseHTMLElementTextualChildren(element),
							color: 'gray_background',
						},
					},
				];
			}
			if (element.getAttribute('class')?.includes('text--rules-sidebar')) {
				return [
					{
						quote: {
							rich_text: parseHTMLElementTextualChildren(element),
							color: 'orange_background',
						},
					},
				];
			}
			return [
				{
					quote: {
						rich_text: parseHTMLElementTextualChildren(element),
					},
				},
			];
		case 'SPAN':
		case 'UL':
			return element.childNodes
				.filter(isHTMLElement)
				.flatMap(parseHTMLElement)
				.filter(Boolean);
		case 'LI':
			return [
				{
					bulleted_list_item: {
						rich_text: parseHTMLElementTextualChildren(element),
					},
				},
			];
		case 'A':
			const hasImageChild =
				element.firstChild &&
				isHTMLElement(element.firstChild) &&
				element.firstChild.tagName === 'IMG';
			const imageSrc = hasImageChild && element.firstChild.getAttribute('src');
			if (hasImageChild && imageSrc) {
				return [
					{
						image: {
							type: 'external',
							external: { url: imageSrc },
						},
					},
				];
			}
			throw new Error('A tag without image' + element.outerHTML);
		case 'DIV': //TODO: more divs to take care of `document.querySelectorAll('section.primary-content div.p-article-content div:not(.stat-block-ability-scores):not(.stat-block-ability-scores-stat):not(.stat-block-ability-scores-heading):not(.stat-block-ability-scores-data):not(.Basic-Text-Frame):not(#comp-next-nav)')`
			// TODO: represent monster stat blocks in a better way
			if (element.getAttribute('class')?.includes('stat-block-background')) {
				const nameLink = element.querySelector('.monster-tooltip');
				if (!nameLink) throw new Error('Monster name not found');
				return [
					{
						bookmark: {
							url: env.BASE_URL + nameLink.getAttribute('href'),
						},
					},
				];
			}
			console.log(element.outerHTML);
			return [];
		case 'SELECT':
		case 'FIGURE': //TODO handle later
		case 'TABLE':
		case 'BR':
			return [];
		case '':
			console.log(
				`Tag ${element.tagName} cannot be transformed into block. Full HTML: ${element.outerHTML}`,
			);
		default:
			throw new Error(`Unknown element: ${element.tagName}`);
	}
};

const contents = getSection()
	.childNodes.filter(isHTMLElement)
	.flatMap(parseHTMLElement)
	.filter(Boolean);

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
console.log('Created page', pageTitle);
