import { useIntl } from 'react-intl';
import React, { useState, useRef, useEffect } from 'react';
import cx from 'classnames';
import IconMagnifier16 from '../../../../res/icons/16/magnifier-2.svg';
import IconMagnifier20 from '../../../../res/icons/20/magnifier.svg';
import IconSearchCancel from '../../../../res/icons/14/searchfield-cancel.svg';

function SearchBox({ query, placeholder, onInput }) {
	const intl = useIntl();
	const [expanded, setExpanded] = useState(!!query.length);
	const inputRef = useRef(null);
	const inputRef2 = useRef(null);

	function handleInput(event) {
		onInput(event.target.value);
	}

	function handleClear(event) {
		onInput('');
		event.preventDefault();
	}

	function handleKeyDown(event) {
		if (event.key === 'Escape') {
			if (event.target.value) {
				handleClear();
				event.stopPropagation();
			}
		}
	}

	function handleFocus() {
		setExpanded(true);
	}

	function handleBlur() {
		if (!inputRef.current.value.length) {
			setExpanded(false);
		}
	}

	function handleMagnifierClick() {
		inputRef.current.focus();
	}

	return (
		<div ref={inputRef2} className={`search-box ${expanded ? 'expanded' : ''}`}>
			<div className="btn magnifier" onClick={handleMagnifierClick}>{expanded ? <IconMagnifier16/> : <IconMagnifier20/>}</div>
			<input
				ref={inputRef}
				id="searchInput"
				type="text"
				placeholder={placeholder}
				value={query}
				autoComplete="off"
				data-tabstop={1}
				onChange={handleInput}
				onKeyDown={handleKeyDown}
				onFocus={handleFocus}
				onBlur={handleBlur}
			/>
			{query.length !== 0 && <div className="btn clear" onClick={handleClear}><IconSearchCancel/></div>}
		</div>
	);
}

export default SearchBox;
