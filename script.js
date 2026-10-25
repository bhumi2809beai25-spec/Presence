/* ============================================================
   ATTENDANCE MANAGER — SCRIPT.JS
   Strictly limited to: logout confirmation, captcha check,
   mobile nav toggle. No other business logic lives here.
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {

  /* ---------------------------------------------------------
     1. MOBILE NAV TOGGLE
  --------------------------------------------------------- */
  var navToggle = document.querySelector('.nav-toggle');
  var siteNav = document.querySelector('.site-nav');

  if (navToggle && siteNav) {
    navToggle.addEventListener('click', function () {
      siteNav.classList.toggle('nav-open');
      var expanded = siteNav.classList.contains('nav-open');
      navToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  /* ---------------------------------------------------------
     1b. THEME TOGGLE (dark / light)
  --------------------------------------------------------- */
  var themeToggle = document.getElementById('themeToggle');
  var htmlEl = document.documentElement;

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = htmlEl.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      htmlEl.setAttribute('data-theme', next);
      try { localStorage.setItem('presence-theme', next); } catch (e) {}

      themeToggle.classList.remove('pulsing');
      void themeToggle.offsetWidth; // restart animation
      themeToggle.classList.add('pulsing');
    });
  }

  /* ---------------------------------------------------------
     2. LOGOUT — handled by the delegated click listener in the
     SPA router script (keeps a single source of truth and lets
     it also clear the simulated auth session; see AuthSim below).
  --------------------------------------------------------- */

  /* ---------------------------------------------------------
     3. CAPTCHA — simple generated code + validation
  --------------------------------------------------------- */
  var captchaDisplays = document.querySelectorAll('.js-captcha-code');

  function randomCaptcha() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = '';
    for (var i = 0; i < 5; i++) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
  }

  captchaDisplays.forEach(function (display) {
    var value = randomCaptcha();
    display.textContent = value;
    display.setAttribute('data-value', value);
  });

  var refreshButtons = document.querySelectorAll('.js-captcha-refresh');
  refreshButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = document.getElementById(btn.getAttribute('data-target'));
      if (!target) return;
      btn.classList.add('spinning');
      var value = randomCaptcha();
      target.textContent = value;
      target.setAttribute('data-value', value);
      var input = document.getElementById(target.getAttribute('data-input'));
      if (input) input.value = '';
      var feedback = document.getElementById(target.getAttribute('data-feedback'));
      if (feedback) { feedback.textContent = ''; feedback.className = 'captcha-feedback'; }
      setTimeout(function () { btn.classList.remove('spinning'); }, 400);
    });
  });

  var authForms = document.querySelectorAll('.js-captcha-form');
  authForms.forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var display = form.querySelector('.js-captcha-code');
      var input = form.querySelector('.js-captcha-input');
      if (!display || !input) return;
      var feedback = document.getElementById(display.getAttribute('data-feedback'));

      var expected = display.getAttribute('data-value');
      var entered = input.value.trim().toUpperCase();

      if (entered !== expected) {
        if (feedback) {
          feedback.textContent = 'Captcha does not match. Please try again.';
          feedback.className = 'captcha-feedback err';
        }
        var refresh = form.querySelector('.js-captcha-refresh');
        if (refresh) refresh.click();
        return;
      }

      if (feedback) {
        feedback.textContent = 'Captcha verified.';
        feedback.className = 'captcha-feedback ok';
      }

      if (form.id === 'login-form' && window.AuthSim) {
        window.AuthSim.handleLogin(form);
      } else if (form.id === 'signup-form' && window.AuthSim) {
        window.AuthSim.handleSignup(form);
      } else {
        alert('Form validated successfully. (UI demo — no backend connected.)');
      }
    });
  });

});

/* ============================================================
   SPA ROUTER — merged single-file navigation
   Every page from the original multi-file site now lives in
   this one document as a <section class="page" id="page-KEY">.
   Instead of rewriting every href by hand, a single delegated
   click handler resolves any internal-looking link (index.html,
   pages/xxx.html, xxx.html, optionally with a #anchor) to its
   matching section and swaps visibility — no page reload.
   ============================================================ */
(function () {
  var pages = document.querySelectorAll('.page');
  var navLinksAll = document.querySelectorAll('.nav-links a');

  function resolvePageKey(href) {
    if (!href) return null;
    var clean = href.split('#')[0];
    clean = clean.replace(/^(\.\.\/)+/, '').replace(/^pages\//, '');
    clean = clean.replace(/\.html$/, '');
    if (clean === '' || clean === 'index') clean = 'home';
    return clean;
  }

  window.showPage = function (name, anchor) {
    var target = document.getElementById('page-' + name);
    if (!target) return;
    pages.forEach(function (p) { p.style.display = 'none'; });
    target.style.display = 'block';

    navLinksAll.forEach(function (a) {
      var key = resolvePageKey(a.getAttribute('href'));
      var isActive = key === name && !a.classList.contains('js-logout');
      a.classList.toggle('active', isActive);
    });

    var siteNav = document.querySelector('.site-nav');
    if (siteNav) siteNav.classList.remove('nav-open');

    if (anchor) {
      setTimeout(function () {
        var el = document.getElementById(anchor);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 30);
    } else {
      window.scrollTo(0, 0);
    }
  };

  document.addEventListener('click', function (e) {
    var logoutEl = e.target.closest('.js-logout');
    if (logoutEl) {
      e.preventDefault();
      if (window.AuthSim) { window.AuthSim.clearSession(); window.AuthSim.updateNavForRole(null); }
      alert('Successfully logged out.');
      showPage('home');
      return;
    }

    var a = e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || /^(https?:)?\/\//.test(href) || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return;

    var key = resolvePageKey(href);
    if (!key) return;
    var target = document.getElementById('page-' + key);
    if (!target) return; // not an internal page link (e.g. plain "#")

    e.preventDefault();
    var anchor = href.indexOf('#') !== -1 ? href.split('#')[1] : null;
    showPage(key, anchor);
  });

  // Initial route
  showPage('home');
})();

/* ============================================================
   AUTH SIMULATION — localStorage only, no backend.
   This is a frontend prototype: "accounts" are plain JSON
   objects saved to localStorage to simulate registration and
   login. Swap the four storage functions below for real API
   calls once a backend exists — nothing else needs to change.
   ============================================================ */
(function () {
  var USERS_KEY = 'am_users';
  var SESSION_KEY = 'am_session';

  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveUsers(users) {
    try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch (e) {}
  }
  function findUser(email) {
    email = (email || '').trim().toLowerCase();
    var match = getUsers().filter(function (u) { return u.email.toLowerCase() === email; });
    return match.length ? match[0] : null;
  }
  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function setSession(user, remember) {
    var data = JSON.stringify({ name: user.name, email: user.email, role: user.role, id: user.id });
    try {
      if (remember) {
        localStorage.setItem(SESSION_KEY, data);
        sessionStorage.removeItem(SESSION_KEY);
      } else {
        sessionStorage.setItem(SESSION_KEY, data);
        localStorage.removeItem(SESSION_KEY);
      }
    } catch (e) {}
  }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  // Seed two demo accounts (one per role) so sign-in can be tried immediately.
  if (getUsers().length === 0) {
    saveUsers([
      { name: 'John', id: 'EMP1001', email: 'john@gmail.com', password: '123456', role: 'teacher' },
      { name: 'Riya', id: '21CS114', email: 'riya@gmail.com', password: '123456', role: 'student' }
    ]);
  }

  /* Show/hide top-nav links AND in-page content based on the signed-in
     role. null = signed out, shows the public (marketing) links and
     hides all role-gated page content. Any element tagged
     data-view-role="teacher"/"student" (in the nav, or inside the
     attendance/medical/reports pages) is gated by this one function so
     a student can never see the teacher's full class register, the
     leave-approval queue, or the institute-wide report — only their
     own data — and vice versa. */
  function updateNavForRole(role) {
    document.querySelectorAll('.nav-links [data-nav-role]').forEach(function (a) {
      var roles = (a.getAttribute('data-nav-role') || '').split(' ');
      var show = role ? roles.indexOf(role) !== -1 : roles.indexOf('public') !== -1;
      a.style.display = show ? '' : 'none';
    });
    var authGroup = document.querySelector('.nav-auth');
    var divider = document.querySelector('.nav-divider');
    if (authGroup) authGroup.style.display = role ? 'none' : '';
    if (divider) divider.style.display = role ? 'none' : '';

    document.querySelectorAll('[data-view-role]').forEach(function (el) {
      var roles = (el.getAttribute('data-view-role') || '').split(' ');
      el.style.display = (role && roles.indexOf(role) !== -1) ? '' : 'none';
    });
  }

  /* Reflect the signed-in user's name/role everywhere it's shown —
     every profile-chip in the document (topbar of every shared page),
     the student identity card, and the dashboard welcome heading.
     Previously this only touched the topbar chip on one page, which
     is why a freshly signed-up name could still show a leftover demo
     name elsewhere. */
  function applySessionToDashboard(session) {
    if (!session) return;
    var initials = session.name.trim().split(/\s+/).map(function (p) { return p.charAt(0); }).join('').slice(0, 2).toUpperCase();
    var roleLabel = session.role === 'teacher' ? 'Teacher' : 'Student';

    document.querySelectorAll('.profile-chip').forEach(function (chip) {
      var nameEl = chip.querySelector('.name');
      var roleEl = chip.querySelector('.role');
      var avatarEl = chip.querySelector('.avatar');
      if (nameEl) nameEl.textContent = session.name;
      if (roleEl) roleEl.textContent = roleLabel;
      if (avatarEl) avatarEl.textContent = initials || avatarEl.textContent;
    });

    var idNameEl = document.getElementById('student-identity-name');
    var idMetaEl = document.getElementById('student-identity-meta');
    var idAvatarEl = document.getElementById('student-identity-avatar');
    if (idNameEl) idNameEl.textContent = session.name;
    if (idMetaEl) idMetaEl.textContent = (session.id ? session.id : 'ID not set');
    if (idAvatarEl) idAvatarEl.textContent = initials || idAvatarEl.textContent;

    var page = document.getElementById(session.role === 'teacher' ? 'page-teacher' : 'page-student');
    var heading = page ? page.querySelector('.page-head h1') : null;
    if (heading) heading.textContent = 'Welcome back, ' + session.name.split(' ')[0] + ' 👋';
  }

  /* ============================================================
     JAVASCRIPT PROMISES — the "fake server" behind sign in / sign up
     ------------------------------------------------------------
     A real login talks to a server, and a server doesn't answer
     instantly. A Promise is JavaScript's way of saying:
        "I don't have the answer yet, but I'll either RESOLVE with
         it or REJECT with an error later."

     States of a Promise:   pending  ->  fulfilled (resolve)
                                     ->  rejected  (reject)

     How this file uses them:
       wait(ms)            a Promise that resolves after a delay
       serverLogin(...)    a Promise that resolves with the user,
                           or rejects with a readable error
       serverSignup(...)   same idea for creating an account
       .then()             runs when the Promise is fulfilled
       .catch()            runs when it is rejected
       .finally()          runs either way (we use it to re-enable
                           the button)
       Promise.all()       waits for several Promises together —
                           here: the server reply AND a short
                           minimum delay so the spinner never just
                           flashes on screen.

     When a real backend exists, only the bodies of serverLogin()
     and serverSignup() change (e.g. return fetch('/api/login')...).
     Everything below them keeps working unchanged.
     ============================================================ */

  var SERVER_DELAY = 650;      // pretend network time (ms)
  var MIN_SPINNER = 500;       // spinner stays visible at least this long

  // A Promise that simply resolves after `ms` milliseconds.
  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  // Pretend server: look the user up, then resolve or reject.
  function serverLogin(email, pass) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        var user = findUser(email);
        if (!user || user.password !== pass) {
          reject(new Error('Incorrect email or password.'));
        } else {
          resolve(user);
        }
      }, SERVER_DELAY);
    });
  }

  // Pretend server: validate, store the new account, resolve with it.
  function serverSignup(data) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        if (!data.id) { reject(new Error('Please enter your Roll No. / Employee ID.')); return; }
        if (!data.role) { reject(new Error('Please select whether you are registering as a Student or Teacher.')); return; }
        if (data.pass !== data.confirm) { reject(new Error('Passwords do not match.')); return; }
        if (findUser(data.email)) { reject(new Error('An account with this email already exists.')); return; }
        var idTaken = getUsers().some(function (u) { return (u.id || '').toLowerCase() === data.id.toLowerCase(); });
        if (idTaken) { reject(new Error('That Roll No. / Employee ID is already registered.')); return; }

        var users = getUsers();
        var newUser = { name: data.name, id: data.id, email: data.email, password: data.pass, role: data.role };
        users.push(newUser);
        saveUsers(users);
        resolve(newUser);
      }, SERVER_DELAY);
    });
  }

  // Button feedback while a Promise is pending (spinner via .is-loading).
  // Returns false if a request is already in flight, so a double-click
  // can never fire two requests at once.
  function setBusy(form, busy, label) {
    var btn = form.querySelector('button[type="submit"]');
    if (!btn) return true;
    if (busy) {
      if (form.dataset.busy === '1') return false;
      form.dataset.busy = '1';
      btn.dataset.label = btn.textContent;
      btn.textContent = label;
      btn.classList.add('is-loading');
      btn.disabled = true;
    } else {
      form.dataset.busy = '0';
      btn.textContent = btn.dataset.label || btn.textContent;
      btn.classList.remove('is-loading');
      btn.disabled = false;
    }
    return true;
  }

  function handleSignup(form) {
    var feedback = document.getElementById('signup-auth-feedback');
    var data = {
      name: document.getElementById('signup-name').value.trim(),
      id: document.getElementById('signup-id').value.trim(),
      email: document.getElementById('signup-email').value.trim(),
      role: document.getElementById('signup-role').value,
      pass: document.getElementById('signup-password').value,
      confirm: document.getElementById('signup-confirm').value
    };

    if (!setBusy(form, true, 'Creating account…')) return;
    clearFeedback(feedback);

    // Wait for the server AND the minimum spinner time, together.
    Promise.all([serverSignup(data), wait(MIN_SPINNER)])
      .then(function (results) {
        var newUser = results[0];                       // [serverReply, waitResult]
        setSession(newUser, false);
        updateNavForRole(newUser.role);
        applySessionToDashboard(getSession());
        setFeedback(feedback, 'Account created! Taking you to your dashboard…', true);
        return wait(700);                               // chain: one more short pause
      })
      .then(function () {
        showPage(data.role === 'teacher' ? 'teacher' : 'student');
      })
      .catch(function (err) {
        setFeedback(feedback, err.message, false);      // any rejection lands here
      })
      .finally(function () {
        setBusy(form, false);                           // always re-enable the button
      });
  }

  function handleLogin(form) {
    var feedback = document.getElementById('login-auth-feedback');
    var email = document.getElementById('login-email').value.trim();
    var pass = document.getElementById('login-password').value;
    var rememberBox = document.getElementById('remember');
    var remember = rememberBox ? rememberBox.checked : false;

    if (!setBusy(form, true, 'Signing in…')) return;
    clearFeedback(feedback);

    var loggedIn;
    Promise.all([serverLogin(email, pass), wait(MIN_SPINNER)])
      .then(function (results) {
        loggedIn = results[0];
        setSession(loggedIn, remember);
        updateNavForRole(loggedIn.role);
        applySessionToDashboard(getSession());
        setFeedback(feedback, 'Signed in! Redirecting…', true);
        return wait(500);
      })
      .then(function () {
        showPage(loggedIn.role === 'teacher' ? 'teacher' : 'student');
      })
      .catch(function (err) {
        setFeedback(feedback, err.message, false);
      })
      .finally(function () {
        setBusy(form, false);
      });
  }

  function setFeedback(el, message, ok) {
    if (!el) return;
    el.textContent = message;
    el.className = 'captcha-feedback ' + (ok ? 'ok' : 'err');
  }
  function clearFeedback(el) {
    if (!el) return;
    el.textContent = '';
    el.className = 'captcha-feedback';
  }

  window.AuthSim = {
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    updateNavForRole: updateNavForRole,
    applySessionToDashboard: applySessionToDashboard,
    handleSignup: handleSignup,
    handleLogin: handleLogin
  };

  // Reflect any existing (persisted) session as soon as the nav exists.
  var existing = getSession();
  updateNavForRole(existing ? existing.role : null);
  if (existing) applySessionToDashboard(existing);
})();


/* ============================================================
   PRESENCE — APP FEATURES (all data in localStorage)
   Added on top of the router + auth code above. No HTML / CSS
   changes needed: everything hooks onto existing ids / classes.

   1. Student  → Attendance Calculator   (attended + DL + ML) ÷ total
   2. Teacher  → Attendance register     (P/A/D/M/L, groups, draft, submit)
   3. Student  → Medical leave form + history, status filter
   4. Student  → Duty leave (New Request), table, stats, timeline
   5. Teacher  → Approve / Reject (dashboard + medical page)
   6. Student / teacher dashboards + reports use the real register data
   7. Settings (theme, language, toggles, account, password)
   8. Search boxes, status filters, notification bell
   ============================================================ */
(function () {
  'use strict';

  var KEY = {
    attendance: 'presence-attendance',
    leaves: 'presence-leaves',
    decisions: 'presence-leave-decisions',
    calc: 'presence-calc',
    seen: 'presence-notif-seen',
    settings: 'presence-settings',
    lang: 'presence-lang'
  };
  var USERS_KEY = 'am_users', SESSION_KEY = 'am_session';
  var EXPIRY_MS = 5 * 24 * 60 * 60 * 1000;     // medical leave auto-expires after 5 days
  var STATUS = ['p', 'a', 'd', 'm', 'l'];
  var STATUS_NAME = { p: 'Present', a: 'Absent', d: 'Duty Leave', m: 'Medical', l: 'Late' };

  /* ---------- helpers ---------- */
  function load(k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function byText(sel, text, root) {
    return $$(sel, root).filter(function (el) { return el.textContent.trim().toLowerCase() === text.toLowerCase(); })[0];
  }
  function d2(n) { return (n < 10 ? '0' : '') + n; }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function today() { var n = new Date(); return n.getFullYear() + '-' + d2(n.getMonth() + 1) + '-' + d2(n.getDate()); }
  function fmtDate(iso) { var d = new Date(iso + 'T00:00:00'); return d2(d.getDate()) + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function fmtRange(a, b) {
    var x = new Date(a + 'T00:00:00'), y = new Date(b + 'T00:00:00');
    if (a === b) return d2(x.getDate()) + ' ' + MONTHS[x.getMonth()];
    if (x.getMonth() === y.getMonth() && x.getFullYear() === y.getFullYear())
      return d2(x.getDate()) + '–' + d2(y.getDate()) + ' ' + MONTHS[y.getMonth()];
    return d2(x.getDate()) + ' ' + MONTHS[x.getMonth()] + ' – ' + d2(y.getDate()) + ' ' + MONTHS[y.getMonth()];
  }

  var toastTimer;
  function toast(msg, type) {
    var old = document.getElementById('presence-toast');
    if (old) old.remove();
    clearTimeout(toastTimer);
    var t = document.createElement('div');
    t.id = 'presence-toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    var bg = type === 'error' ? '#dc2626' : type === 'ok' ? '#16a34a' : '#2563eb';
    t.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:99999;max-width:320px;padding:12px 18px;' +
      'border-radius:12px;font-size:14px;line-height:1.4;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.35);' +
      'background:' + bg + ';opacity:0;transform:translateY(8px);transition:opacity .2s,transform .2s;';
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
    toastTimer = setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 250); }, 3000);
  }

  /* show / hide without fighting other scripts that set inline display */
  function vis(el) {
    var hide = el.dataset.fs === '1' || el.dataset.fc === '1';
    if (hide) {
      if (el.dataset.fhid !== '1') { el.dataset.fprev = el.style.display; el.dataset.fhid = '1'; }
      el.style.display = 'none';
    } else if (el.dataset.fhid === '1') {
      el.style.display = el.dataset.fprev || '';
      el.dataset.fhid = '0';
    }
  }

  /* ---------- who is signed in ---------- */
  function me() {
    var s = window.AuthSim && window.AuthSim.getSession && window.AuthSim.getSession();
    return { name: (s && s.name) || '', id: (s && s.id) || '', role: (s && s.role) || '', email: (s && s.email) || '' };
  }
  function isMe(roll, name) {
    var s = me();
    return !!((s.id && String(roll).toLowerCase() === s.id.toLowerCase()) ||
              (s.name && String(name).toLowerCase() === s.name.toLowerCase()));
  }

  /* =====================================================================
     DATA: submitted register records
     ===================================================================== */
  function submittedRows() {
    var all = load(KEY.attendance, {}), out = [];
    Object.keys(all).forEach(function (k) {
      var rec = all[k];
      if (!rec || rec.state !== 'submitted' || !rec.rows) return;
      Object.keys(rec.rows).forEach(function (roll) {
        var r = rec.rows[roll];
        out.push({ roll: roll, name: r.name, status: r.status, meta: rec.meta || {}, savedAt: rec.savedAt || 0, teacher: rec.teacher || '' });
      });
    });
    out.sort(function (a, b) { return ((a.meta.date || '') + ('0000000000000' + a.savedAt).slice(-13)) < ((b.meta.date || '') + ('0000000000000' + b.savedAt).slice(-13)) ? -1 : 1; });
    return out;
  }
  function studentRecords() { return submittedRows().filter(function (r) { return isMe(r.roll, r.name); }); }
  function tally(list) {
    var c = { p: 0, a: 0, d: 0, m: 0, l: 0 };
    list.forEach(function (x) { if (c[x.status] !== undefined) c[x.status]++; });
    return c;
  }
  /* attended (P + Late) + DL + ML, divided by total classes */
  function pctOf(list) {
    if (!list.length) return 0;
    var c = tally(list);
    return (c.p + c.l + c.d + c.m) / list.length * 100;
  }
  function fmtPct(n) { return (Math.round(n * 10) / 10).toFixed(1) + '%'; }

  /* =====================================================================
     1. ATTENDANCE CALCULATOR (student section)
     ===================================================================== */
  var calcCustom = false;

  function calcEls() {
    var box = document.getElementById('calculator');
    if (!box) return null;
    return {
      box: box,
      pct: document.getElementById('calc-current'),
      total: document.getElementById('calc-total'),
      att: document.getElementById('calc-attended'),
      fut: document.getElementById('calc-future')
    };
  }

  function calculate(silent) {
    var E = calcEls();
    if (!E || !E.total || !E.att || !E.fut) return false;
    var total = parseFloat(E.total.value), att = parseFloat(E.att.value), fut = parseFloat(E.fut.value);
    if (isNaN(fut) || fut < 0) fut = 0;
    if (isNaN(total) || total <= 0) { if (!silent) toast('Enter total classes conducted (more than 0).', 'error'); return false; }
    if (isNaN(att) || att < 0) { if (!silent) toast('Enter a valid number for classes attended.', 'error'); return false; }
    if (att > total) { if (!silent) toast('Classes attended cannot be more than total classes.', 'error'); return false; }

    var c = tally(studentRecords());                       // DL + ML come from the teacher's register
    var eff = Math.min(att + c.d + c.m, total);
    var pct = eff / total * 100;

    var rows = $$('.calc-result-row', E.box);
    function setRow(i, text) { var b = rows[i] && $('b', rows[i]); if (b) b.textContent = text; }
    if (E.pct) { E.pct.readOnly = true; E.pct.title = 'Calculated: (attended + DL + ML) ÷ total classes'; E.pct.value = Math.round(pct * 10) / 10; }
    setRow(0, fmtPct(eff / (total + 1) * 100));
    setRow(1, fmtPct(eff / (total + 2) * 100));
    setRow(2, fmtPct(eff / (total + 5) * 100));
    setRow(3, fmtPct((eff + fut) / (total + fut) * 100));
    setRow(4, pct >= 75 ? '0 — already safe' : Math.ceil(3 * total - 4 * eff) + ' classes');

    var ring = $('.ring-fg', E.box), num = $('.ring-label b', E.box), lbl = $('.ring-label span', E.box), zone = $('.zone-tag', E.box);
    if (ring) {
      ring.setAttribute('stroke-dashoffset', String(314 * (1 - Math.min(pct, 100) / 100)));
      ring.classList.remove('yellow', 'red', 'green');
      ring.classList.add(pct < 75 ? 'red' : pct < 85 ? 'yellow' : 'green');
    }
    if (num) num.textContent = fmtPct(pct);
    if (lbl) lbl.textContent = 'current';
    if (zone) {
      zone.classList.remove('warn', 'safe', 'danger');
      if (pct >= 85) { zone.classList.add('safe'); zone.textContent = '✅ Safe Zone'; }
      else if (pct >= 75) { zone.classList.add('warn'); zone.textContent = '⚠ Warning Zone'; }
      else { zone.classList.add('danger'); zone.textContent = '🚫 Danger Zone'; }
    }
    var note = document.getElementById('calc-leave-note');
    if (!note && zone) {
      note = document.createElement('p');
      note.id = 'calc-leave-note';
      note.className = 'text-dim';
      note.style.cssText = 'font-size:12.5px;margin-top:12px;';
      zone.insertAdjacentElement('afterend', note);
    }
    if (note) note.textContent = 'Counted: ' + att + ' attended + ' + c.d + ' DL + ' + c.m + ' ML = ' + eff + ' of ' + total + ' classes';

    save(KEY.calc, { total: E.total.value, attended: E.att.value, future: E.fut.value, custom: calcCustom });
    return true;
  }

  function prefillFromRegister() {
    var E = calcEls(); if (!E) return;
    var recs = studentRecords();
    if (!calcCustom && recs.length) {
      var c = tally(recs);
      E.total.value = recs.length;
      E.att.value = c.p + c.l;                 // physically attended (present + late)
    }
  }

  function refreshCalculator() {
    var E = calcEls(); if (!E) return;
    prefillFromRegister();
    calculate(true);
  }

  function initCalculator() {
    var E = calcEls(); if (!E || !E.total) return;
    var saved = load(KEY.calc, null);
    if (saved) {
      calcCustom = !!saved.custom;
      if (calcCustom) { E.total.value = saved.total; E.att.value = saved.attended; E.fut.value = saved.future; }
      else if (saved.future !== undefined) E.fut.value = saved.future;
    }
    [E.total, E.att, E.fut].forEach(function (el) {
      el.addEventListener('input', function (ev) { if (ev.isTrusted) calcCustom = true; calculate(true); });
    });
    var btns = $$('button', E.box);
    var calcBtn = btns.filter(function (b) { return /calculate/i.test(b.textContent); })[0];
    var resetBtn = btns.filter(function (b) { return /reset/i.test(b.textContent); })[0];
    if (calcBtn) calcBtn.addEventListener('click', function () {
      if (calculate(false)) toast('Attendance calculated.', 'ok');
    });
    if (resetBtn) resetBtn.addEventListener('click', function () {
      calcCustom = false;
      [E.total, E.att, E.fut].forEach(function (el) { el.value = el.defaultValue; });
      try { localStorage.removeItem(KEY.calc); } catch (e) {}
      prefillFromRegister();
      calculate(true);
      toast('Calculator reset.');
    });
  }

  /* =====================================================================
     2. TEACHER ATTENDANCE REGISTER
     ===================================================================== */
  var REG_TPL = null;

  function regTable() { return document.getElementById('student-table'); }
  function regRows() { var t = regTable(); return t ? $$('tbody tr', t) : []; }
  function rowStatus(tr) {
    var b = $('.status-toggle button.on', tr);
    if (!b) return 'p';
    return STATUS.filter(function (s) { return b.classList.contains(s); })[0] || 'p';
  }
  function setRowStatus(tr, s) {
    $$('.status-toggle button', tr).forEach(function (b) { b.classList.toggle('on', b.classList.contains(s)); });
  }
  function remarkInput(tr) { return $('input[type="text"]', tr); }
  function rowRoll(tr) { return tr.cells[0].textContent.trim(); }
  function rowName(tr) { var n = $('.name-cell', tr) || tr.cells[1]; return n.textContent.trim(); }

  function currentSel() {
    var g = $('.group-pill.on');
    return {
      type: (document.getElementById('student-type') || {}).value || '',
      group: g ? g.textContent.trim() : '',
      subject: (document.getElementById('subject') || {}).value || '',
      date: (document.getElementById('att-date') || {}).value || '',
      lecture: (document.getElementById('lecture') || {}).value || ''
    };
  }
  function selKey(s) { return [s.type, s.group, s.subject, s.date, s.lecture].join('|'); }

  function updateRegTitle() {
    var t = regTable(); if (!t) return;
    var h = $('.table-toolbar h3', t); if (!h) return;
    var s = currentSel();
    h.textContent = 'Student Register — ' + s.group + ' · ' + s.subject + ' · ' + s.lecture;
  }

  function buildGroupPills() {
    var typeEl = document.getElementById('student-type'), pills = $$('.group-pill');
    if (!typeEl || !pills.length) return;
    var base = /host/i.test(typeEl.value) ? 8 : 1;
    pills.forEach(function (p, i) { p.textContent = 'G' + (base + i); p.classList.toggle('on', i === 0); });
  }

  /* every registered student account shows up in the register */
  function ensureStudentRows() {
    var t = regTable(); if (!t) return;
    var rows = regRows(); if (!rows.length) return;
    if (!REG_TPL) REG_TPL = rows[0].cloneNode(true);
    var have = {};
    rows.forEach(function (tr) { have[rowRoll(tr).toLowerCase()] = 1; });
    var body = $('tbody', t), added = false;
    load(USERS_KEY, []).forEach(function (u) {
      if (u.role !== 'student' || !u.id || have[u.id.toLowerCase()]) return;
      var tr = REG_TPL.cloneNode(true);
      tr.setAttribute('data-user-row', '1');
      tr.cells[0].textContent = u.id;
      ($('.name-cell', tr) || tr.cells[1]).textContent = u.name;
      setRowStatus(tr, 'p');
      var inp = remarkInput(tr); if (inp) inp.value = '';
      body.appendChild(tr);
      have[u.id.toLowerCase()] = 1;
      added = true;
    });
    var span = $('.pagination span', t);
    var n = regRows().length;
    if (span) span.textContent = 'Showing 1–' + n + ' of ' + Math.max(58, n) + ' students';
    if (added) reloadRegister(false);
  }

  function applyRecord(rec) {
    regRows().forEach(function (tr) {
      var r = rec.rows[rowRoll(tr)];
      if (r) { setRowStatus(tr, r.status); var i = remarkInput(tr); if (i) i.value = r.remark || ''; }
    });
  }
  function resetRegister() {
    regRows().forEach(function (tr) { setRowStatus(tr, 'p'); var i = remarkInput(tr); if (i) i.value = ''; });
  }
  function reloadRegister(userChanged) {
    if (!regTable()) return;
    updateRegTitle();
    var rec = load(KEY.attendance, {})[selKey(currentSel())];
    if (rec) {
      applyRecord(rec);
      if (userChanged) toast('Loaded ' + rec.state + ' register for this class.');
    } else if (userChanged) {
      resetRegister();
    }
    refreshCard(regTable());
  }

  function saveRegister(state) {
    var s = currentSel();
    if (!s.date) { toast('Pick a date first.', 'error'); return; }
    var rows = {}, counts = { p: 0, a: 0, d: 0, m: 0, l: 0 };
    regRows().forEach(function (tr) {
      var st = rowStatus(tr), i = remarkInput(tr);
      counts[st]++;
      rows[rowRoll(tr)] = { name: rowName(tr), status: st, remark: i ? i.value.trim() : '' };
    });
    var all = load(KEY.attendance, {});
    all[selKey(s)] = { state: state, savedAt: Date.now(), meta: s, rows: rows, counts: counts, teacher: me().name };
    save(KEY.attendance, all);
    toast((state === 'submitted' ? 'Attendance submitted — ' : 'Draft saved — ') +
      'P ' + counts.p + ' · A ' + counts.a + ' · D ' + counts.d + ' · M ' + counts.m + ' · L ' + counts.l, 'ok');
    renderTeacherViews();
  }

  /* =====================================================================
     3. LEAVES — data (medical + duty)
     ===================================================================== */
  function leaves() {
    var list = load(KEY.leaves, []), now = Date.now(), changed = false;
    list.forEach(function (r) {
      if (r.type === 'medical' && r.status === 'Pending' && now - r.applied > EXPIRY_MS) { r.status = 'Expired'; changed = true; }
    });
    if (changed) save(KEY.leaves, list);
    return list;
  }
  function mine(r) {
    var s = me();
    return (s.id && r.studentId === s.id) || (!s.id && r.studentName === s.name);
  }
  function addLeave(type, fields) {
    var s = me(), now = new Date(), list = load(KEY.leaves, []);
    var r = {
      id: type[0] + now.getTime(),
      type: type,
      studentId: s.id,
      studentName: s.name,
      applied: now.getTime(),
      appliedDate: today(),
      appliedTime: d2(now.getHours()) + ':' + d2(now.getMinutes()),
      start: fields.start,
      end: fields.end,
      reason: fields.reason,
      cert: fields.cert || '',
      status: 'Pending',
      comment: ''
    };
    list.push(r);
    save(KEY.leaves, list);
    return r;
  }

  /* ---------- medical page: student history ---------- */
  function medTable() {
    return $$('table').filter(function (t) { return t.tHead && /certificate/i.test(t.tHead.textContent); })[0];
  }
  function renderMedicalHistory() {
    var tbl = medTable(); if (!tbl) return;
    var body = tbl.tBodies[0];
    $$('tr[data-stored]', body).forEach(function (r) { r.remove(); });
    leaves().filter(function (r) { return r.type === 'medical' && mine(r); }).forEach(function (r) {
      var tr = document.createElement('tr');
      tr.setAttribute('data-stored', '1');
      tr.innerHTML = '<td>' + esc(fmtDate(r.appliedDate)) + '</td><td>' + esc(fmtRange(r.start, r.end)) + '</td>' +
        '<td>' + esc(r.reason) + '</td><td>📄 ' + esc(r.cert || 'no file') + '</td>' +
        '<td><span class="badge ' + r.status.toLowerCase() + '">' + esc(r.status) + '</span></td>';
      body.insertBefore(tr, body.firstChild);
    });
    var card = tbl.closest('.table-card');
    if (card) {
      refreshCard(card);
      var span = $('.pagination span', card), rows = $$('tbody tr', card);
      var shown = rows.filter(function (tr) { return tr.style.display !== 'none'; }).length;
      if (span) span.textContent = 'Showing ' + shown + ' of ' + rows.length + ' requests';
    }
  }

  function submitMedical(form) {
    if (me().role !== 'student') { toast('Only students can apply for medical leave.', 'error'); return; }
    var reason = document.getElementById('med-reason'), start = document.getElementById('med-start'),
        end = document.getElementById('med-end'), cert = document.getElementById('med-cert');
    if (!reason.value.trim()) { toast('Please describe the medical reason.', 'error'); reason.focus(); return; }
    if (!start.value || !end.value) { toast('Select both start and end dates.', 'error'); return; }
    if (end.value < start.value) { toast('End date cannot be before start date.', 'error'); return; }
    if (!cert.files || !cert.files.length) { toast('Please attach your medical certificate.', 'error'); return; }
    addLeave('medical', { start: start.value, end: end.value, reason: reason.value.trim(), cert: cert.files[0].name });
    form.reset();
    renderMedicalHistory();
    renderApprovals();
    refreshNotifs();
    toast('Medical leave request submitted.', 'ok');
  }

  /* ---------- duty leave page ---------- */
  function dutyTable() {
    return $$('table').filter(function (t) { return t.tHead && /event/i.test(t.tHead.textContent); })[0];
  }
  function dutyStat(label) {
    var page = document.getElementById('page-duty-leave'); if (!page) return null;
    var card = $$('.stat-card', page).filter(function (c) { var l = $('.label', c); return l && l.textContent.trim() === label; })[0];
    return card ? $('.value', card) : null;
  }

  function renderDuty() {
    var tbl = dutyTable(); if (!tbl) return;
    var body = tbl.tBodies[0], card = tbl.closest('.table-card');
    $$('tr[data-stored]', body).forEach(function (r) { r.remove(); });
    var mineList = leaves().filter(function (r) { return r.type === 'duty' && mine(r); });
    mineList.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.setAttribute('data-stored', '1');
      tr.innerHTML = '<td class="name-cell">' + esc(r.reason) + '</td><td>' + esc(fmtRange(r.start, r.end)) + '</td>' +
        '<td>' + esc(fmtRange(r.appliedDate, r.appliedDate)) + '</td>' +
        '<td><span class="badge ' + r.status.toLowerCase() + '">' + esc(r.status) + '</span></td>';
      body.insertBefore(tr, body.firstChild);
    });

    ['Pending', 'Approved', 'Rejected'].forEach(function (label) {
      var v = dutyStat(label); if (!v) return;
      if (v.dataset.base === undefined) v.dataset.base = parseInt(v.textContent, 10) || 0;
      v.textContent = (parseInt(v.dataset.base, 10) + mineList.filter(function (r) { return r.status === label; }).length);
    });

    if (card) {
      var span = $('.pagination span', card);
      if (span && span.dataset.base === undefined) span.dataset.base = (span.textContent.match(/of\s+(\d+)/) || [0, 16])[1];
      refreshCard(card);
      var rows = $$('tbody tr', card), shown = rows.filter(function (tr) { return tr.style.display !== 'none'; }).length;
      if (span) span.textContent = 'Showing ' + shown + ' of ' + (parseInt(span.dataset.base, 10) + mineList.length) + ' requests';
    }

    var items = $$('.timeline-item');
    items = items.filter(function (i) { return i.closest('#page-duty-leave'); });
    var latest = mineList[mineList.length - 1];
    if (latest && items.length >= 3) {
      var ps = items.map(function (i) { return $('p', i); }), bs = items.map(function (i) { return $('b', i); });
      ps[0].textContent = fmtRange(latest.appliedDate, latest.appliedDate) + ', ' + latest.appliedTime + ' — ' + latest.reason;
      ps[1].textContent = fmtRange(latest.appliedDate, latest.appliedDate) + ', ' + latest.appliedTime + ' — Teacher notified';
      var dot = $('.timeline-dot', items[2]);
      if (latest.status === 'Pending') {
        bs[2].textContent = 'Awaiting Approval'; ps[2].textContent = 'Expected response within 3 working days';
        dot.className = 'timeline-dot pending-dot';
      } else {
        bs[2].textContent = latest.status; ps[2].textContent = latest.comment ? 'Teacher comment: ' + latest.comment : 'Decision recorded by your teacher';
        dot.className = 'timeline-dot done';
      }
    }
  }

  function openDutyModal() {
    if (document.getElementById('presence-duty-modal')) return;
    if (me().role !== 'student') { toast('Only students can raise duty leave requests.', 'error'); return; }
    var ov = document.createElement('div');
    ov.id = 'presence-duty-modal';
    ov.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);padding:20px;';
    ov.innerHTML = '<form class="glass-card card" style="width:100%;max-width:440px;">' +
      '<h3 style="margin-bottom:18px;">New Duty Leave Request</h3>' +
      '<div class="field"><label for="dl-event">Event / duty</label><input type="text" id="dl-event" placeholder="e.g. Inter-college Hackathon"></div>' +
      '<div class="grid-2"><div class="field"><label for="dl-start">From</label><input type="date" id="dl-start"></div>' +
      '<div class="field"><label for="dl-end">To</label><input type="date" id="dl-end"></div></div>' +
      '<div class="flex gap-12" style="justify-content:flex-end;"><button type="button" class="btn btn-ghost" id="dl-cancel">Cancel</button>' +
      '<button type="submit" class="btn btn-primary">Submit Request</button></div></form>';
    document.body.appendChild(ov);
    var form = $('form', ov);
    function close() { ov.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    $('#dl-cancel', ov).addEventListener('click', close);
    $('#dl-event', ov).focus();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ev = $('#dl-event', ov).value.trim(), s = $('#dl-start', ov).value, en = $('#dl-end', ov).value || s;
      if (!ev) { toast('Enter the event or duty name.', 'error'); return; }
      if (!s) { toast('Select the start date.', 'error'); return; }
      if (en < s) { toast('End date cannot be before start date.', 'error'); return; }
      addLeave('duty', { start: s, end: en, reason: ev });
      close();
      renderDuty();
      renderApprovals();
      refreshNotifs();
      toast('Duty leave request submitted.', 'ok');
    });
  }

  /* =====================================================================
     4. TEACHER APPROVALS (medical page + dashboard)
     ===================================================================== */
  var HOSTS = [
    { title: 'Pending Approval', types: ['medical'] },
    { title: 'Pending Leave Approvals', types: ['medical', 'duty'] }
  ];
  var TPL = {};

  function leaveName(card) {
    var b = $('b', card);
    return b ? b.textContent.split('—')[0].trim() : '';
  }

  function renderApprovals() {
    HOSTS.forEach(function (H) {
      var h = byText('h3', H.title); if (!h) return;
      var host = h.parentElement;
      var first = $('.leave-card:not([data-req-id])', host);
      if (!TPL[H.title] && first) TPL[H.title] = first.outerHTML;
      $$('[data-req-id],[data-req-hr]', host).forEach(function (n) { n.remove(); });
      if (!TPL[H.title] || !first) return;

      leaves().filter(function (r) { return r.status === 'Pending' && H.types.indexOf(r.type) > -1; })
        .reverse().forEach(function (r) {
          var wrap = document.createElement('div');
          wrap.innerHTML = TPL[H.title];
          var card = wrap.firstElementChild;
          card.setAttribute('data-req-id', r.id);
          var b = $('b', card), ps = $$('p.text-dim', card), isDash = /—/.test(b.textContent);
          var typeLabel = r.type === 'duty' ? 'Duty' : 'Medical';
          if (isDash) {
            b.textContent = r.studentName + ' — ' + typeLabel + ' Leave';
            if (ps[0]) ps[0].textContent = fmtRange(r.start, r.end) + ' · ' + r.reason + (r.cert ? ', certificate attached' : '');
            var th = $('.file-thumb', card); if (th) th.textContent = r.type === 'duty' ? '🗂️' : '🩺';
          } else {
            b.textContent = r.studentName;
            if (ps[0]) ps[0].textContent = 'Roll ' + r.studentId + ' · ' + r.reason;
            if (ps[1]) ps[1].textContent = fmtRange(r.start, r.end) + ' · Applied ' + fmtRange(r.appliedDate, r.appliedDate) +
              (r.cert ? ' · Certificate: ' + r.cert : '');
          }
          var ta = $('textarea', card); if (ta) ta.value = '';
          var badge = $('.badge', card); if (badge) { badge.className = 'badge pending'; badge.textContent = 'Pending'; }
          var hr = document.createElement('hr');
          hr.className = 'rule';
          hr.setAttribute('data-req-hr', '1');
          host.insertBefore(card, first);
          host.insertBefore(hr, first);
        });
    });
  }

  function paintDecision(card, status) {
    var cls = status.toLowerCase();
    var head = $('.badge', card), actions = $('.actions', card);
    if (head) { head.className = 'badge ' + cls; head.textContent = status; }
    if (actions) actions.innerHTML = '<span class="badge ' + cls + '">' + status + '</span>';
    var ta = $('textarea', card); if (ta) ta.disabled = true;
  }

  function decide(card, status) {
    var id = card.getAttribute('data-req-id');
    if (id) {
      var list = load(KEY.leaves, []);
      list.forEach(function (r) {
        if (r.id === id) { r.status = status; var ta = $('textarea', card); r.comment = ta ? ta.value.trim() : ''; }
      });
      save(KEY.leaves, list);
      renderMedicalHistory();
      renderDuty();
      renderApprovals();
    } else {
      var name = leaveName(card), dec = load(KEY.decisions, {});
      dec[name] = status;
      save(KEY.decisions, dec);
      $$('.leave-card:not([data-req-id])').forEach(function (c) { if (leaveName(c) === name) paintDecision(c, status); });
    }
    refreshNotifs();
    toast('Leave ' + status.toLowerCase() + '.', status === 'Approved' ? 'ok' : 'error');
  }

  function restoreDecisions() {
    var dec = load(KEY.decisions, {});
    $$('.leave-card:not([data-req-id])').forEach(function (c) {
      var s = dec[leaveName(c)];
      if (s) paintDecision(c, s);
    });
  }

  /* =====================================================================
     5. DASHBOARDS + REPORTS use the real register data
     ===================================================================== */
  var STAT_UI = {
    p: ['✅', 'var(--success-soft)', 'var(--success)', 'present', 'Present'],
    a: ['🚫', 'var(--danger-soft)', 'var(--danger)', 'absent', 'Absent'],
    l: ['⏰', 'var(--warning-soft)', 'var(--warning)', 'late', 'Late'],
    d: ['🗂️', 'rgba(196,181,253,0.15)', '#c4b5fd', 'duty', 'Duty Leave'],
    m: ['🩺', 'var(--accent-soft)', 'var(--accent-2)', 'medical', 'Medical']
  };

  function setStat(scope, label, text) {
    var card = $$('.stat-card', scope).filter(function (c) { var l = $('.label', c); return l && l.textContent.trim() === label; })[0];
    var v = card && $('.value', card);
    if (v) v.textContent = text;
  }
  function setStatPlusStored(scope, label, count) {
    var card = $$('.stat-card', scope).filter(function (c) { var l = $('.label', c); return l && l.textContent.trim() === label; })[0];
    var v = card && $('.value', card);
    if (!v) return;
    if (v.dataset.base === undefined) v.dataset.base = parseInt(v.textContent, 10) || 0;
    v.textContent = parseInt(v.dataset.base, 10) + count;
  }

  function applySubjectBars(scope, recs) {
    var below = 0;
    $$('.progress-bar', scope).forEach(function (bar) {
      var wrap = bar.parentElement, nameEl = $('.flex span', wrap), valEl = $('.flex b', wrap);
      if (!nameEl || !valEl) return;
      var sub = recs.filter(function (r) { return r.meta.subject === nameEl.textContent.trim(); });
      if (!sub.length) return;
      var pct = pctOf(sub);
      valEl.textContent = Math.round(pct) + '%';
      bar.classList.remove('green', 'red');
      if (pct >= 90) bar.classList.add('green'); else if (pct < 75) bar.classList.add('red');
      var fill = $('span', bar); if (fill) fill.style.width = Math.min(pct, 100) + '%';
    });
    $$('.progress-bar', scope).forEach(function (bar) {
      var v = $('.flex b', bar.parentElement);
      if (v && parseInt(v.textContent, 10) < 75) below++;
    });
    return below;
  }

  function applyStudentScope(scope, withToday) {
    if (!scope) return;
    var recs = studentRecords();
    if (!recs.length) return;
    var pct = pctOf(recs);

    var ring = $$('.ring-fg', scope).filter(function (r) { return !r.closest('#calculator'); })[0];
    var lab = $$('.ring-label b', scope).filter(function (r) { return !r.closest('#calculator'); })[0];
    if (ring) {
      ring.setAttribute('stroke-dashoffset', String(314 * (1 - Math.min(pct, 100) / 100)));
      ring.classList.remove('yellow', 'red', 'green');
      if (pct < 75) ring.classList.add('red'); else if (pct < 85) ring.classList.add('yellow');
    }
    if (lab) lab.textContent = fmtPct(pct);

    var below = applySubjectBars(scope, recs);

    var rh = byText('h3', 'Recent Attendance', scope);
    var feed = rh && $('.activity-feed', rh.parentElement);
    if (feed) {
      feed.innerHTML = recs.slice(-3).reverse().map(function (r) {
        var u = STAT_UI[r.status] || STAT_UI.p;
        var when = r.meta.date === today() ? 'Today' : (r.meta.date ? fmtDate(r.meta.date) : '');
        return '<div class="activity-item"><div class="activity-dot" style="background:' + u[1] + '; color:' + u[2] + ';">' + u[0] + '</div>' +
          '<div class="activity-text"><b>' + esc(r.meta.subject || '') + '</b><p>' + esc(r.meta.lecture || '') + ' · ' + esc(when) + '</p></div>' +
          '<span class="badge ' + u[3] + '">' + u[4] + '</span></div>';
      }).join('');
    }

    if (withToday) {
      var th = byText('h4', "Today's Status", scope);
      var card = th && th.parentElement;
      if (card) {
        var badge = $('.badge', card), p = $('p', card);
        var todays = recs.filter(function (r) { return r.meta.date === today(); });
        var last = todays[todays.length - 1];
        if (last) {
          var u = STAT_UI[last.status] || STAT_UI.p;
          badge.className = 'badge ' + u[3]; badge.textContent = u[4];
          p.textContent = 'Marked by ' + (last.teacher || 'your teacher') + ' for ' + (last.meta.subject || '') + '.';
        } else {
          badge.className = 'badge pending'; badge.textContent = 'Not marked';
          p.textContent = 'No attendance has been marked for you today.';
        }
      }
    }
    return below;
  }

  function renderStudentViews() {
    if (me().role !== 'student') return;
    applyStudentScope(document.getElementById('page-student'), true);
    applyStudentScope($('#page-attendance [data-view-role="student"]'), false);
    var rep = $('#page-reports [data-view-role="student"]');
    if (rep) {
      var recs = studentRecords();
      if (recs.length) {
        applyStudentScope(rep, false);
        setStat(rep, 'Your Overall Attendance', fmtPct(pctOf(recs)));
        var below = $$('.progress-bar', rep).filter(function (b) { var v = $('.flex b', b.parentElement); return v && parseInt(v.textContent, 10) < 75; }).length;
        setStat(rep, 'Subjects Below 75%', below);
      }
      setStatPlusStored(rep, 'Your Leave Requests', leaves().filter(mine).length);
    }
  }

  var BELOW_ORIG = null;
  function renderTeacherViews() {
    if (me().role !== 'teacher') return;
    var rows = submittedRows();

    /* per-student % across all submitted lectures */
    function perStudent(list) {
      var map = {};
      list.forEach(function (r) { (map[r.roll] = map[r.roll] || { roll: r.roll, name: r.name, recs: [] }).recs.push(r); });
      return Object.keys(map).map(function (k) { map[k].pct = pctOf(map[k].recs); return map[k]; });
    }
    var all = perStudent(rows);
    var belowAll = all.filter(function (s) { return s.pct < 75; }).sort(function (a, b) { return a.pct - b.pct; });

    /* dashboard: Students Below 75% table */
    var h = byText('h3', 'Students Below 75%');
    var card = h && h.closest('.table-card'), body = card && $('tbody', card);
    if (body) {
      if (BELOW_ORIG === null) BELOW_ORIG = body.innerHTML;
      if (!rows.length) body.innerHTML = BELOW_ORIG;
      else if (!belowAll.length) body.innerHTML = '<tr><td colspan="4" style="text-align:center;">No students below 75% 🎉</td></tr>';
      else body.innerHTML = belowAll.map(function (s) {
        return '<tr><td>' + esc(s.roll) + '</td><td class="name-cell">' + esc(s.name) + '</td><td>' + Math.round(s.pct) +
          '%</td><td><span class="badge absent">Warning</span></td></tr>';
      }).join('');
    }

    /* dashboard: Class Summary (Data Structures) */
    var ch = $$('h3').filter(function (x) { return /^Class Summary/.test(x.textContent.trim()); })[0];
    if (ch && rows.length) {
      var ds = perStudent(rows.filter(function (r) { return r.meta.subject === 'Data Structures'; }));
      var crow = $$('.calc-result-row', ch.parentElement);
      if (ds.length && crow.length >= 3) {
        var avg = ds.reduce(function (a, s) { return a + s.pct; }, 0) / ds.length;
        $('b', crow[1]).textContent = fmtPct(avg);
        $('b', crow[2]).textContent = ds.filter(function (s) { return s.pct < 75; }).length + ' students';
      }
    }

    /* reports (teacher view) */
    var rep = $('#page-reports [data-view-role="teacher"]');
    if (rep) {
      if (rows.length) {
        setStat(rep, 'Overall Attendance', fmtPct(pctOf(rows)));
        setStat(rep, 'Students Below 75%', belowAll.length);
        applySubjectBars(rep, rows);
      }
      setStatPlusStored(rep, 'Leave Requests This Month', leaves().length);
    }
  }

  /* =====================================================================
     6. SETTINGS
     ===================================================================== */
  function applyTheme(v) {
    var theme = v;
    if (v === 'system') {
      try { localStorage.removeItem('presence-theme'); } catch (e) {}
      theme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
    } else {
      try { localStorage.setItem('presence-theme', v); } catch (e) {}
    }
    document.documentElement.setAttribute('data-theme', theme);
  }

  function refreshSettings() {
    var page = document.getElementById('page-settings'); if (!page) return;
    var saved = null;
    try { saved = localStorage.getItem('presence-theme'); } catch (e) {}
    var idx = saved === 'dark' ? 0 : saved === 'light' ? 1 : 2;
    $$('input[name="theme"]', page).forEach(function (r, i) {
      r.checked = i === idx;
      var lab = r.closest('label'); if (lab) lab.style.borderColor = i === idx ? 'var(--accent)' : '';
    });
    var lang = document.getElementById('lang-select'), sl = load(KEY.lang, null);
    if (lang && sl !== null) lang.selectedIndex = sl;
    var st = load(KEY.settings, {});
    $$('input[type="checkbox"]', page).forEach(function (c, i) { if (st[i] !== undefined) c.checked = st[i]; });
    var s = me();
    var n = document.getElementById('acc-name'), e = document.getElementById('acc-email');
    if (n && s.name) n.value = s.name;
    if (e && s.email) e.value = s.email;
  }

  function updateAccount() {
    var s = me(); if (!s.email) { toast('Sign in first.', 'error'); return; }
    var name = document.getElementById('acc-name').value.trim(), email = document.getElementById('acc-email').value.trim();
    if (!name) { toast('Name cannot be empty.', 'error'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid email address.', 'error'); return; }
    var users = load(USERS_KEY, []);
    if (email.toLowerCase() !== s.email.toLowerCase() && users.some(function (u) { return u.email.toLowerCase() === email.toLowerCase(); })) {
      toast('That email is already registered.', 'error'); return;
    }
    var user = users.filter(function (u) { return u.email.toLowerCase() === s.email.toLowerCase(); })[0];
    if (!user) { toast('Account not found.', 'error'); return; }
    user.name = name; user.email = email;
    save(USERS_KEY, users);
    var remember = !!localStorage.getItem(SESSION_KEY);
    window.AuthSim.setSession(user, remember);
    window.AuthSim.applySessionToDashboard(window.AuthSim.getSession());
    toast('Account updated.', 'ok');
  }

  function updatePassword() {
    var s = me(); if (!s.email) { toast('Sign in first.', 'error'); return; }
    var cur = document.getElementById('cur-pass'), nw = document.getElementById('new-pass');
    var users = load(USERS_KEY, []);
    var user = users.filter(function (u) { return u.email.toLowerCase() === s.email.toLowerCase(); })[0];
    if (!user) { toast('Account not found.', 'error'); return; }
    if (cur.value !== user.password) { toast('Current password is incorrect.', 'error'); return; }
    if (nw.value.length < 6) { toast('New password must be at least 6 characters.', 'error'); return; }
    if (nw.value === cur.value) { toast('New password must be different.', 'error'); return; }
    user.password = nw.value;
    save(USERS_KEY, users);
    cur.value = ''; nw.value = '';
    toast('Password updated.', 'ok');
  }

  /* =====================================================================
     7. SEARCH / FILTERS / NOTIFICATIONS
     ===================================================================== */
  var ITEM_SEL = 'tbody tr, .activity-item, .leave-card';

  function refreshCard(card) {
    if (!card) return;
    var inp = $('.toolbar-search input', card), q = inp ? inp.value.trim().toLowerCase() : '';
    var sel = $('.toolbar-filters select', card);
    var f = sel && sel.selectedIndex > 0 ? sel.options[sel.selectedIndex].text.trim().toLowerCase() : '';
    var isRegister = card.id === 'student-table';
    var isMonthPicker = sel && /\d{4}/.test(sel.options[0].text);     // "July 2026" pickers are not status filters
    $$(ITEM_SEL, card).forEach(function (el) {
      var hide = false;
      if (q && el.textContent.toLowerCase().indexOf(q) < 0) {
        var typed = $$('input[type="text"]', el).map(function (i) { return i.value; }).join(' ').toLowerCase();
        if (typed.indexOf(q) < 0) hide = true;
      }
      if (!hide && f && !isMonthPicker) {
        if (isRegister) {
          var code = STATUS.filter(function (s) { return STATUS_NAME[s].toLowerCase() === f; })[0];
          if (code && rowStatus(el) !== code) hide = true;
        } else {
          var badge = $('.badge', el);
          if (!badge || badge.textContent.trim().toLowerCase() !== f) hide = true;
        }
      }
      el.dataset.fc = hide ? '1' : '0';
      vis(el);
    });
  }

  function topbarSearch(input) {
    var scope = input.closest('.main-area') || document, q = input.value.trim().toLowerCase();
    $$(ITEM_SEL, scope).forEach(function (el) {
      el.dataset.fs = (q && el.textContent.toLowerCase().indexOf(q) < 0) ? '1' : '0';
      vis(el);
    });
  }

  function notifIds() {
    var s = me();
    if (s.role === 'teacher') return leaves().filter(function (r) { return r.status === 'Pending'; }).map(function (r) { return r.id; });
    if (s.role === 'student') return leaves().filter(function (r) { return mine(r) && r.status !== 'Pending'; }).map(function (r) { return r.id + r.status; });
    return [];
  }
  function refreshNotifs() {
    var sig = notifIds().join(','), seen = load(KEY.seen, '');
    $$('.icon-btn[aria-label="Notifications"] .dot').forEach(function (d) {
      d.style.display = (sig && sig !== seen) ? '' : 'none';
    });
  }
  function openNotifs() {
    var s = me(), ids = notifIds();
    if (s.role === 'teacher') toast(ids.length ? 'You have ' + ids.length + ' pending leave request' + (ids.length > 1 ? 's' : '') + '.' : 'No pending approvals.');
    else if (s.role === 'student') toast(ids.length ? ids.length + ' of your leave request' + (ids.length > 1 ? 's have' : ' has') + ' been decided.' : 'No new notifications.');
    else toast('No new notifications.');
    save(KEY.seen, ids.join(','));
    refreshNotifs();
  }

  /* =====================================================================
     WIRING
     ===================================================================== */
  function refreshAll() {
    ensureStudentRows();
    renderMedicalHistory();
    renderDuty();
    renderApprovals();
    restoreDecisions();
    refreshCalculator();
    renderStudentViews();
    renderTeacherViews();
    refreshSettings();
    refreshNotifs();
  }

  /* groups only: the Section dropdown is hidden */
  function hideSectionField() {
    var sec = document.getElementById('section');
    var field = sec && sec.closest('.field');
    if (field) {
      field.style.display = 'none';
      if (field.parentElement) field.parentElement.style.gridTemplateColumns = '1fr';
    }
    $$('.step').forEach(function (st) {
      if (/section\s*&\s*subject/i.test(st.textContent) && st.lastChild) st.lastChild.textContent = 'Subject';
    });
  }

  function init() {
    initCalculator();

    hideSectionField();
    var dt = document.getElementById('att-date');
    if (dt && dt.value === dt.defaultValue) dt.value = today();      // register opens on today's date
    if (regTable()) { buildGroupPills(); reloadRegister(false); }

    var form = document.getElementById('medical-request-card');
    if (form) {
      form.addEventListener('submit', function (e) { e.preventDefault(); submitMedical(form); });
      var s = document.getElementById('med-start'), en = document.getElementById('med-end');
      if (s && en) s.addEventListener('change', function () { en.min = s.value; if (en.value && en.value < s.value) en.value = s.value; });
    }
    refreshAll();
  }

  /* re-render whenever the router switches page (login, nav links, redirects) */
  var origShowPage = window.showPage;
  if (typeof origShowPage === 'function') {
    window.showPage = function () {
      var r = origShowPage.apply(this, arguments);
      refreshAll();
      return r;
    };
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('.js-logout')) return;                     // router handles logout

    var tog = t.closest('.status-toggle button');
    if (tog) {
      var tr = tog.closest('tr');
      var code = STATUS.filter(function (s) { return tog.classList.contains(s); })[0];
      if (tr && code) { setRowStatus(tr, code); refreshCard(regTable()); }
      return;
    }

    var pill = t.closest('.group-pill');
    if (pill) {
      $$('.group-pill').forEach(function (p) { p.classList.toggle('on', p === pill); });
      reloadRegister(true);
      return;
    }

    if (t.closest('.icon-btn[aria-label="Notifications"]')) { openNotifs(); return; }

    var act = t.closest('.leave-card .btn-success, .leave-card .btn-danger');
    if (act) { decide(act.closest('.leave-card'), act.classList.contains('btn-success') ? 'Approved' : 'Rejected'); return; }

    var pg = t.closest('.page-btns button');
    if (pg) {
      var txt = pg.textContent.trim();
      if (/^\d+$/.test(txt)) {
        $$('.page-btns button', pg.parentNode).forEach(function (b) { b.classList.toggle('on', b === pg); });
      }
      return;
    }

    var sn = t.closest('.settings-nav button:not(.js-logout)');
    if (sn) {
      $$('.settings-nav button').forEach(function (b) { b.classList.toggle('active', b === sn); });
      var key = ['Theme', 'Language', 'Notifications', 'Account', 'Security'].filter(function (k) { return sn.textContent.indexOf(k) > -1; })[0];
      var h = key && byText('h3', key, document.getElementById('page-settings'));
      var panel = h && h.closest('.glass-card');
      if (panel && panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    var btn = t.closest('button');
    if (!btn) return;
    var label = btn.textContent.trim().toLowerCase();

    if (regTable() && btn.closest('#page-attendance')) {
      if (label === 'save draft') { saveRegister('draft'); return; }
      if (label === 'submit attendance') { saveRegister('submitted'); return; }
    }
    if (label === 'new request' && btn.closest('#page-duty-leave')) { openDutyModal(); return; }
    if (btn.closest('#page-settings')) {
      if (label === 'save changes') { updateAccount(); return; }
      if (label === 'update password') { updatePassword(); return; }
    }
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.id === 'student-type') { buildGroupPills(); reloadRegister(true); return; }
    if (['subject', 'att-date', 'lecture'].indexOf(t.id) > -1) { reloadRegister(true); return; }
    if (t.name === 'theme' && t.closest('#page-settings')) {
      var v = ['dark', 'light', 'system'][$$('input[name="theme"]', t.closest('#page-settings')).indexOf(t)];
      applyTheme(v);
      refreshSettings();
      return;
    }
    if (t.id === 'lang-select') {
      save(KEY.lang, t.selectedIndex);
      document.documentElement.setAttribute('lang', ['en', 'hi', 'fr', 'es'][t.selectedIndex] || 'en');
      toast('Language preference saved.', 'ok');
      return;
    }
    if (t.type === 'checkbox' && t.closest('#page-settings')) {
      var st = load(KEY.settings, {});
      st[$$('#page-settings input[type="checkbox"]').indexOf(t)] = t.checked;
      save(KEY.settings, st);
      toast('Setting saved.');
      return;
    }
    if (t.closest('.toolbar-filters')) refreshCard(t.closest('.table-card'));
  });

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('.topbar-search')) { topbarSearch(t); return; }
    if (t.closest('.toolbar-search')) refreshCard(t.closest('.table-card, .card'));
  });

  window.addEventListener('storage', function () { refreshAll(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
