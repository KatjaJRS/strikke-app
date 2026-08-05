// -- Initialisering -----------------------------------------------------
function enforceDayAwayText() {
	// Guard against stale cached text from older deployments.
	const replaceLife = (value) => String(value || '').replace(/Life Away/gi, 'Day Away');

	document.title = replaceLife(document.title);

	const titleNodes = document.querySelectorAll('h1[data-i18n="heroTitle"], .auth-title');
	titleNodes.forEach((node) => {
		node.textContent = replaceLife(node.textContent);
	});
}

enforceDayAwayText();
applyLanguage(currentLanguage);
enforceDayAwayText();
initAuth();
