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

function syncPasswordToggleButtons() {
	const passwordInputs = document.querySelectorAll('input[type="password"], input[data-password-toggle-bound="true"]');
	passwordInputs.forEach((input) => {
		if (!input.dataset.passwordToggleBound) {
			input.dataset.passwordToggleBound = 'true';
			const toggleButton = document.createElement('button');
			toggleButton.type = 'button';
			toggleButton.className = 'password-toggle';
			toggleButton.setAttribute('aria-pressed', 'false');
			toggleButton.addEventListener('click', () => {
				input.type = input.type === 'password' ? 'text' : 'password';
				toggleButton.setAttribute('aria-pressed', input.type === 'text' ? 'true' : 'false');
				toggleButton.textContent = input.type === 'text'
					? translations[currentLanguage].hidePassword
					: translations[currentLanguage].showPassword;
			});
			input.insertAdjacentElement('afterend', toggleButton);
		}

		const toggleButton = input.nextElementSibling;
		if (toggleButton && toggleButton.classList.contains('password-toggle')) {
			toggleButton.textContent = input.type === 'text'
				? translations[currentLanguage].hidePassword
				: translations[currentLanguage].showPassword;
			toggleButton.setAttribute('aria-pressed', input.type === 'text' ? 'true' : 'false');
		}
	});
}

enforceDayAwayText();
applyLanguage(currentLanguage);
enforceDayAwayText();
syncPasswordToggleButtons();
initAuth();
