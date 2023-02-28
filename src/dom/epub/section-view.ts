import Section from "epubjs/types/section";
import StyleScoper from "./lib/style-scoper";
import { isSafari } from "../../common/lib/utilities";
import DOMPurify from "dompurify";
import { DOMPURIFY_CONFIG } from "../common/lib/nodes";

class SectionView {
	readonly section: Section;
	
	readonly container: HTMLElement;

	private readonly _window: Window & typeof globalThis;
	
	private readonly _document: Document;
	
	private readonly _styleScoper: StyleScoper;
	
	constructor(options: {
		section: Section,
		container: HTMLElement,
		window: Window & typeof globalThis,
		document: Document,
		styleScoper: StyleScoper,
	}) {
		this.section = options.section;
		this.container = options.container;
		this._window = options.window;
		this._document = options.document;
		this._styleScoper = options.styleScoper;
	}

	async initWithHTML(html: string): Promise<void> {
		const sectionDoc = new DOMParser().parseFromString(html, 'application/xhtml+xml');
		const walker = this._document.createTreeWalker(sectionDoc, NodeFilter.SHOW_ELEMENT);
		const toRemove = [];
		const toAwait = [];
		
		// Work around a WebKit bug - see DOMView constructor for details
		if (isSafari) {
			DOMPurify.sanitize(document.documentElement, {
				...DOMPURIFY_CONFIG,
				IN_PLACE: true,
			});
		}

		const REPLACE_TAGS = new Set(['html', 'head', 'body', 'base', 'meta']);
		
		let elem: Element | null = null;
		// eslint-disable-next-line no-unmodified-loop-condition
		while ((elem = walker.nextNode() as Element)) {
			if (REPLACE_TAGS.has(elem.tagName)) {
				const newElem = this._document.createElement('replaced-' + elem.tagName);
				for (const attr of elem.getAttributeNames()) {
					newElem.setAttribute(attr, elem.getAttribute(attr)!);
				}
				newElem.append(...elem.childNodes);
				elem.replaceWith(newElem);
				walker.currentNode = newElem;
			}
			else if (elem.tagName == 'style') {
				this.container.classList.add(
					await this._styleScoper.add(elem.innerHTML || '')
				);
				toRemove.push(elem);
			}
			else if (elem.tagName == 'link' && elem.getAttribute('rel') == 'stylesheet') {
				const link = elem as HTMLLinkElement;
				try {
					this.container.classList.add(
						await this._styleScoper.addByURL(link.href)
					);
				}
				catch (e) {
					console.error(e);
				}
				toRemove.push(elem);
			}
			else if (elem.tagName == 'img') {
				// We'll wait for images to load (or error) before returning
				toAwait.push((elem as HTMLImageElement).decode());
			}
			else if (elem.tagName == 'title') {
				toRemove.push(elem);
			}
		}
		
		for (const elem of toRemove) {
			elem.remove();
		}
		
		this.container.append(...sectionDoc.childNodes);
		
		await Promise.allSettled(toAwait).catch();
	}
	
	/**
	 * Return a range before or at the top of the viewport.
	 *
	 * @param isHorizontal Whether the viewport is laid out horizontally (paginated mode)
	 * @param textNodesOnly Return only text nodes, for constructing CFIs
	 */
	getFirstVisibleRange(isHorizontal: boolean, textNodesOnly: boolean): Range | null {
		const viewportEnd = isHorizontal ? this._window.frameElement!.clientWidth : this._window.frameElement!.clientHeight;
		const filter = NodeFilter.SHOW_TEXT | (textNodesOnly ? 0 : NodeFilter.SHOW_ELEMENT);
		const iter = this._document.createNodeIterator(this.container, filter, (node) => {
			return node.nodeType == Node.TEXT_NODE && node.nodeValue?.trim().length
					|| (node as Element).tagName === 'IMG'
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_SKIP;
		});
		let node = null;
		let bestRange = null;
		while ((node = iter.nextNode())) {
			const range = this._document.createRange();
			if (node.nodeType == Node.ELEMENT_NODE) {
				range.selectNode(node);
			}
			else {
				range.selectNodeContents(node);
			}
			
			const rect = range.getBoundingClientRect();
			// Skip invisible nodes
			if (!(rect.width || rect.height)) {
				continue;
			}
			const rectStart = isHorizontal ? rect.left : rect.top;
			const rectEnd = isHorizontal ? rect.right : rect.bottom;
			// If the range starts past the end of the viewport, we've gone too far -- return our previous best guess
			if (rectStart > viewportEnd) {
				return bestRange;
			}
			// If it starts in the viewport, return it immediately
			if (rectStart >= 0 || (rectStart < 0 && rectEnd > 0)) {
				return range;
			}
			// Otherwise, it's above the start of the viewport -- save it as our best guess in case nothing within
			// the viewport is usable, but keep going
			else {
				bestRange = range;
			}
		}
		return null;
	}
}

export default SectionView;