const authForm = document.querySelector('#auth-form');
const articleList = document.querySelector('#article-list');
const articleForm = document.querySelector('#article-form');
const themeToggle = document.querySelector('#theme-toggle');

if (themeToggle) {
  const themeIcon = themeToggle.querySelector('.theme-icon');
  const savedTheme = localStorage.getItem('site-theme');
  const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';

  function setTheme(theme, save = false) {
    document.documentElement.dataset.theme = theme;
    const nextTheme = theme === 'night' ? 'jour' : 'nuit';
    themeToggle.setAttribute('aria-label', `Activer le thème ${nextTheme}`);
    themeToggle.title = `Activer le thème ${nextTheme}`;
    themeIcon.textContent = theme === 'night' ? '☀' : '☾';
    if (save) localStorage.setItem('site-theme', theme);
  }

  setTheme(savedTheme === 'day' || savedTheme === 'night' ? savedTheme : preferredTheme);
  themeToggle.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'night' ? 'day' : 'night', true);
  });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function isPasswordValid(user, password) {
  if (!user || !password) return false;

  if (typeof user.password === 'string') {
    return user.password === password;
  }

  if (user.hash && user.salt && window.PasswordUtils && typeof window.PasswordUtils.verifyPassword === 'function') {
    return window.PasswordUtils.verifyPassword(password, user.hash, user.salt, window.PASSWORD_PEPPER);
  }

  return false;
}

async function createPasswordRecord(password) {
  if (!password) return { hash: '', salt: '' };
  if (!window.PasswordUtils || typeof window.PasswordUtils.hashPassword !== 'function') {
    return { hash: password, salt: '' };
  }
  return window.PasswordUtils.hashPassword(password, undefined, window.PASSWORD_PEPPER);
}

async function getConnectedUser() {
  const email = normalizeEmail(sessionStorage.getItem('connectedEmail'));
  if (!email) return null;

  const user = await window.SupabaseClient?.findUserByEmail ? window.SupabaseClient.findUserByEmail(email) : null;
  if (user) return user;

  const response = await fetch(`/users?email=${encodeURIComponent(email)}`);
  if (!response.ok) throw new Error('Impossible de vérifier le compte.');
  const users = await response.json();
  const match = users.find((entry) => normalizeEmail(entry.email) === email);
  if (!match) sessionStorage.removeItem('connectedEmail');
  return match || null;
}

function configureAccountNavigation(user) {
  const accountLabel = document.querySelector('#account-label');
  const loginLink = document.querySelector('#login-link');
  const writeLink = document.querySelector('#write-link');
  const adminLink = document.querySelector('#admin-link');
  const logoutButton = document.querySelector('#logout-button');

  if (accountLabel) {
    accountLabel.hidden = !user;
    accountLabel.textContent = user?.email || '';
  }
  if (loginLink) loginLink.hidden = Boolean(user);
  if (writeLink) writeLink.hidden = !user;
  if (adminLink) adminLink.hidden = user?.author !== true;
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

function makeAdminCell(value, className = '') {
  const cell = document.createElement('td');
  cell.textContent = value;
  if (className) cell.className = className;
  return cell;
}

function refreshAdminCount(body, countElement, emptyMessage) {
  const rowCount = body.querySelectorAll('.admin-data-row').length;
  countElement.textContent = String(rowCount).padStart(2, '0');
  body.querySelector('.admin-empty-row')?.remove();

  if (rowCount === 0) {
    const row = document.createElement('tr');
    row.className = 'admin-empty-row';
    const cell = makeAdminCell(emptyMessage);
    cell.colSpan = Number(body.dataset.columns);
    row.append(cell);
    body.append(row);
  }
}

function addAdminDeleteButton(row, resource, entry, description, onDelete, disabled = false) {
  const cell = document.createElement('td');
  const button = document.createElement('button');
  button.className = 'admin-delete-button';
  button.type = 'button';
  button.textContent = 'Supprimer';
  button.disabled = disabled;
  if (disabled) button.title = 'Impossible de supprimer le compte actuellement connecté.';

  button.addEventListener('click', async () => {
    if (!window.confirm(`Supprimer ${description} ? Cette action est définitive.`)) return;

    button.disabled = true;
    const status = document.querySelector('#admin-status');
    try {
      if (resource === 'users' && window.SupabaseClient?.deleteUserRecord) {
        await window.SupabaseClient.deleteUserRecord(entry.id);
      } else {
        const response = await fetch(`/${resource}/${encodeURIComponent(entry.id)}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Suppression impossible');
      }
      row.remove();
      onDelete();
      status.textContent = `${description} supprimé.`;
    } catch {
      status.textContent = `Impossible de supprimer ${description}. Réessayez.`;
      button.disabled = false;
    }
  });

  cell.append(button);
  row.append(cell);
}

async function loadAdminData(currentUser) {
  const status = document.querySelector('#admin-status');
  const usersBody = document.querySelector('#users-body');
  const articlesBody = document.querySelector('#admin-articles-body');
  const usersCount = document.querySelector('#users-count');
  const articlesCount = document.querySelector('#admin-articles-count');

  try {
    const users = await (window.SupabaseClient?.listUsers ? window.SupabaseClient.listUsers() : fetch('/users').then((response) => {
      if (!response.ok) throw new Error('Chargement impossible');
      return response.json();
    }));
    const articlesResponse = await fetch('/article');
    if (!articlesResponse.ok) throw new Error('Chargement impossible');
    const articles = await articlesResponse.json();

    users.sort((first, second) => String(first.email || '').localeCompare(String(second.email || ''), 'fr'));
    articles.sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime());

    usersBody.replaceChildren();
    users.forEach((user) => {
      const row = document.createElement('tr');
      row.className = 'admin-data-row';
      row.append(makeAdminCell(user.email || 'Adresse inconnue'));
      row.append(makeAdminCell(user.author === true ? 'Auteur' : 'Compte'));
      addAdminDeleteButton(
        row,
        'users',
        user,
        `le compte ${user.email || 'sans adresse'}`,
        () => refreshAdminCount(usersBody, usersCount, 'Aucun compte utilisateur.'),
        user.id === currentUser.id
      );
      usersBody.append(row);
    });
    refreshAdminCount(usersBody, usersCount, 'Aucun compte utilisateur.');

    articlesBody.replaceChildren();
    articles.forEach((article) => {
      const row = document.createElement('tr');
      row.className = 'admin-data-row';
      row.append(makeAdminCell(article.titre || 'Sans titre', 'admin-article-name'));
      row.append(makeAdminCell(formatArticleDate(article.date)));
      row.append(makeAdminCell(article.publier === true ? 'Publié' : 'Brouillon'));
      addAdminDeleteButton(
        row,
        'article',
        article,
        `l’article « ${article.titre || 'Sans titre'} »`,
        () => refreshAdminCount(articlesBody, articlesCount, 'Aucun article.')
      );
      articlesBody.append(row);
    });
    refreshAdminCount(articlesBody, articlesCount, 'Aucun article.');
    status.textContent = '';
  } catch {
    status.textContent = 'Les données ne peuvent pas être chargées. Réessayez dans un instant.';
  }
}

if (document.body.dataset.page === 'admin') {
  const adminMain = document.querySelector('#admin-main');
  const accessDenied = document.querySelector('#admin-denied');
  const accessTitle = document.querySelector('#admin-access-title');
  const accessMessage = document.querySelector('#admin-access-message');
  const accessAction = document.querySelector('#admin-access-action');

  getConnectedUser().then((user) => {
    configureAccountNavigation(user);
    if (!user || user.author !== true) {
      accessTitle.textContent = user ? 'Accès administrateur requis.' : 'Connexion requise.';
      accessMessage.textContent = user
        ? 'Ce compte ne dispose pas des droits d’administration.'
        : 'Connectez-vous avec un compte administrateur.';
      accessAction.href = user ? 'index.html' : 'login.html';
      accessAction.firstChild.textContent = user ? 'Retour au journal ' : 'Se connecter ';
      accessDenied.hidden = false;
      return;
    }

    adminMain.hidden = false;
    loadAdminData(user);
  }).catch(() => {
    configureAccountNavigation(null);
    accessMessage.textContent = 'Le compte ne peut pas être vérifié. Réessayez dans un instant.';
    accessDenied.hidden = false;
  });
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
      const existingUser = await (window.SupabaseClient?.findUserByEmail ? window.SupabaseClient.findUserByEmail(email) : fetch(`/users?email=${encodeURIComponent(email)}`).then(async (response) => {
        if (!response.ok) throw new Error('API indisponible');
        const users = await response.json();
        return users.find((entry) => normalizeEmail(entry.email) === email) || null;
      }));

      let account;
      if (mode === 'signup') {
        if (existingUser) {
          if (typeof existingUser.password === 'string' || (existingUser.hash && existingUser.salt)) {
            message.textContent = 'Un compte existe déjà avec cette adresse e-mail.';
            return;
          }

          const passwordRecord = await createPasswordRecord(password);
          account = await (window.SupabaseClient?.updateUserRecord
            ? window.SupabaseClient.updateUserRecord(existingUser.id, { email, hash: passwordRecord.hash, salt: passwordRecord.salt })
            : fetch(`/users/${existingUser.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, hash: passwordRecord.hash, salt: passwordRecord.salt })
              }).then((response) => {
                if (!response.ok) throw new Error('Mise à jour du compte impossible');
                return response.json();
              }));
        } else {
          const passwordRecord = await createPasswordRecord(password);
          account = await (window.SupabaseClient?.createUserRecord
            ? window.SupabaseClient.createUserRecord({ email, hash: passwordRecord.hash, salt: passwordRecord.salt, author: false })
            : fetch('/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, hash: passwordRecord.hash, salt: passwordRecord.salt, author: false })
              }).then((response) => {
                if (!response.ok) throw new Error('Création du compte impossible');
                return response.json();
              }));
        }
      } else {
        if (!existingUser) {
          message.textContent = 'Adresse e-mail ou mot de passe incorrect.';
          return;
        }

        const valid = await isPasswordValid(existingUser, password);
        if (!valid) {
          message.textContent = 'Adresse e-mail ou mot de passe incorrect.';
          return;
        }
        account = existingUser;
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