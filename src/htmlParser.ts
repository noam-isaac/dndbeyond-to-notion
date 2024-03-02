import fs from 'fs';
import { HTMLElement, Node, TextNode, parse } from 'node-html-parser';

export const filterHTMLElements = (node: Node): node is HTMLElement =>
	node instanceof HTMLElement;
export const filterTextNodes = (node: Node): node is TextNode =>
	node instanceof TextNode;

const html = fs.readFileSync('index.html', 'utf8');
const parsedHtml = parse(html);
export const getSection = () => {
	const section = parsedHtml
		?.querySelector('section.primary-content div.p-article-content')
		?.removeWhitespace();
	if (!section) {
		throw new Error('Could not find article in html file.');
	}
	return section;
};
