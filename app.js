// -- Initialisering -----------------------------------------------------
function enforceDayAwayText() {
	// Guard against stale cached text from older deployments.
	const replaceLife = (value) => String(value || '').replace(/Life Away/gi, 'Day Away');
	const targetProjectsHeading = translations[currentLanguage]?.projectsHeading || 'Other projects';
	const replaceProjects = (value) => String(value || '').replace(/Previous projects|Andre projekter|Other projects/gi, targetProjectsHeading);

	document.title = replaceLife(document.title);

	const titleNodes = document.querySelectorAll('h1[data-i18n="heroTitle"], .auth-title');
	titleNodes.forEach((node) => {
		node.textContent = replaceLife(node.textContent);
	});

	const projectNodes = document.querySelectorAll('[data-i18n="projectsHeading"]');
	projectNodes.forEach((node) => {
		node.textContent = replaceProjects(node.textContent);
	});
}

enforceDayAwayText();
applyLanguage(currentLanguage);
enforceDayAwayText();
initAuth();
