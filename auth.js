const authForm = document.querySelector('#auth-form');
const articleList = document.querySelector('#article-list');
const articleForm = document.querySelector('#article-form');

async function getConnectedUser() {
  const email = sessionStorage.getItem('connectedEmail');
  if (!email) return null;

  const response = await fetch(`/users?email=${encodeURIComponent(email)}`);
  if (!response.ok) throw new Error('Impossible de vérifier le compte.');
  const users = await response.json();
  const user = users.find((entry) => entry.email === email);
  if (!user) sessionStorage.removeItem('connectedEmail');
  return user || null;
}

function configureAccountNavigation(user) {
  const accountLabel = document.querySelector('#account-label');
  const loginLink = document.querySelector('#login-link');
  const writeLink = document.querySelector('#write-link');
  const logoutButton = document.querySelector('#logout-button');

  if (accountLabel) {
    accountLabel.hidden = !user;
    accountLabel.textContent = user?.email || '';
  }
  if (loginLink) loginLink.hidden = Boolean(user);
  if (writeLink) writeLink.hidden = !user;
  if (logoutButton) {
    logoutButton.hidden = !user;
    logoutButton.addEventListener('click', () => {
      sessionStorage.removeItem('connectedEmail');
      sessionStorage.removeItem('connectedAuthor');
      window.location.href = 'login.html';
    });
  }
}

function formatArticleDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date inconnue';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function renderArticle(article) {
  const entry = document.createElement('article');
  entry.className = 'article-entry';

  const metadata = document.createElement('div');
  metadata.className = 'article-entry-meta';
  const date = document.createElement('time');
  date.className = 'article-date';
  date.dateTime = article.date || '';
  date.textContent = formatArticleDate(article.date);
  const publication = document.createElement('span');
  publication.className = article.publier === true ? 'publication-status is-published' : 'publication-status';
  publication.textContent = article.publier === true ? 'Publié' : 'Brouillon';
  metadata.append(date, publication);

  const title = document.createElement('h2');
  title.className = 'article-title';
  title.textContent = article.titre || 'Sans titre';

  const content = document.createElement('div');
  content.className = 'article-copy';
  String(article.article || '').split(/\n{2,}/).forEach((paragraphText) => {
    const paragraph = document.createElement('p');
    paragraph.textContent = paragraphText;
    content.append(paragraph);
  });

  entry.append(metadata, title, content);
  return entry;
}

async function loadArticles() {
  const status = document.querySelector('#article-status');
  try {
    const response = await fetch('/article');
    if (!response.ok) throw new Error('Chargement impossible');
    const articles = await response.json();
    articles.sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime());
    document.querySelector('#article-count').textContent = String(articles.length).padStart(2, '0');
    articleList.replaceChildren(...articles.map(renderArticle));
    status.textContent = articles.length ? '' : 'Aucun article pour le moment.';
  } catch {
    status.textContent = 'Les articles ne peuvent pas être chargés pour le moment.';
  }
}

if (articleList) {
  getConnectedUser()
    .then((user) => configureAccountNavigation(user))
    .catch(() => configureAccountNavigation(null));
  loadArticles();
}

if (document.body.dataset.page === 'write') {
  const writerMain = document.querySelector('#write-main');
  const accessDenied = document.querySelector('#access-denied');
  const accessTitle = document.querySelector('#access-title');
  const accessMessage = document.querySelector('#access-message');
  const accessAction = document.querySelector('#access-action');

  getConnectedUser().then((user) => {
    configureAccountNavigation(user);
    if (!user) {
      accessTitle.textContent = 'Connexion requise.';
      accessMessage.textContent = 'Connectez-vous pour écrire un article.';
      accessAction.href = 'login.html';
      accessAction.firstChild.textContent = 'Se connecter ';
      accessDenied.hidden = false;
      return;
    }

    writerMain.hidden = false;
    document.querySelector('#date-note').textContent = `Date : ${formatArticleDate(new Date())}`;
  }).catch(() => {
    configureAccountNavigation(null);
    accessMessage.textContent = 'Le compte ne peut pas être vérifié. Réessayez dans un instant.';
    accessDenied.hidden = false;
  });
}

if (articleForm) {
  const submitButton = articleForm.querySelector('.submit-button');
  const message = document.querySelector('#article-message');

  articleForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    message.textContent = '';
    const formData = new FormData(articleForm);

    try {
      const user = await getConnectedUser();
      if (!user) {
        window.location.replace('login.html');
        return;
      }

      const response = await fetch('/article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre: String(formData.get('titre')).trim(),
          article: String(formData.get('article')).trim(),
          date: new Date().toISOString(),
          publier: formData.get('publier') === 'on'
        })
      });
      if (!response.ok) throw new Error('Enregistrement impossible');
      window.location.href = 'index.html';
    } catch {
      message.textContent = 'L’article n’a pas pu être enregistré. Réessayez.';
    } finally {
      submitButton.disabled = false;
    }
  });
}

if (authForm) {
  let mode = 'login';
  const confirmField = document.querySelector('.confirm-field');
  const confirmInput = document.querySelector('#confirm-password');
  const submitButton = authForm.querySelector('.submit-button');
  const message = document.querySelector('#form-message');

  document.querySelectorAll('[data-mode]').forEach((tab) => {
    tab.addEventListener('click', () => {
      mode = tab.dataset.mode;
      document.querySelectorAll('[data-mode]').forEach((item) => {
        const active = item === tab;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-selected', String(active));
      });
      confirmField.hidden = mode !== 'signup';
      confirmInput.required = mode === 'signup';
      document.querySelector('#password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
      submitButton.firstChild.textContent = mode === 'signup' ? 'Créer mon compte ' : 'Se connecter ';
      message.textContent = '';
    });
  });

  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(authForm);
    if (mode === 'signup' && formData.get('password') !== formData.get('confirm-password')) {
      message.textContent = 'Les mots de passe ne correspondent pas.';
      confirmInput.focus();
      return;
    }

    submitButton.disabled = true;
    message.textContent = '';
    const email = String(formData.get('email')).trim().toLowerCase();
    const password = String(formData.get('password'));
    try {
      const usersResponse = await fetch(`/users?email=${encodeURIComponent(email)}`);
      if (!usersResponse.ok) throw new Error('API indisponible');
      const users = await usersResponse.json();

      let account;
      if (mode === 'signup') {
        if (users.length > 0) {
          if (typeof users[0].password === 'string') {
            message.textContent = 'Un compte existe déjà avec cette adresse e-mail.';
            return;
          }

          const migrateResponse = await fetch(`/users/${users[0].id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          if (!migrateResponse.ok) throw new Error('Mise à jour du compte impossible');
          account = await migrateResponse.json();
        } else {
          const createResponse = await fetch('/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, author: false })
          });
          if (!createResponse.ok) throw new Error('Création du compte impossible');
          account = await createResponse.json();
        }
      } else {
        account = users.find((entry) => entry.password === password);
        if (!account) {
          message.textContent = 'Adresse e-mail ou mot de passe incorrect.';
          return;
        }
      }

      sessionStorage.setItem('connectedEmail', email);
      sessionStorage.setItem('connectedAuthor', String(account.author === true));
      window.location.href = 'index.html';
    } catch {
      message.textContent = 'Le serveur est indisponible. Réessayez dans un instant.';
    } finally {
      submitButton.disabled = false;
    }
  });
}