from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import os
from dotenv import load_dotenv
from groq import Groq
import time
import secrets
import re
from collections import defaultdict
from datetime import datetime, timedelta
from functools import wraps

app = Flask(__name__)
@app.after_request
def add_no_cache_headers(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    return response
app.secret_key = "change-this-to-a-random-secret-key"
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)
app.config['SESSION_COOKIE_SECURE'] = False    # set True once you're on HTTPS in production
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

DB_PATH = "users.db"


load_dotenv()

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)
SYSTEM_PROMPT = """You are NexAI, a helpful AI assistant."""


# ---------- Simple in-memory rate limiter ----------
# Keyed by IP address. Good enough for a single-process dev/small-scale
# deployment; swap for Flask-Limiter + Redis if you ever run multiple
# worker processes, since this dict isn't shared across them.
LOGIN_WINDOW_SECONDS = 15 * 60      # 15 minutes
LOGIN_MAX_ATTEMPTS = 5              # failed logins allowed per window
SIGNUP_WINDOW_SECONDS = 60 * 60     # 1 hour
SIGNUP_MAX_ATTEMPTS = 5             # new accounts allowed per IP per window

_login_attempts = defaultdict(list)
_signup_attempts = defaultdict(list)


def _client_ip():
    return request.headers.get('X-Forwarded-For', request.remote_addr) or 'unknown'


def _prune(bucket, key, window):
    now = time.time()
    bucket[key] = [t for t in bucket[key] if now - t < window]


def is_rate_limited(bucket, key, window, max_attempts):
    _prune(bucket, key, window)
    return len(bucket[key]) >= max_attempts


def record_attempt(bucket, key):
    bucket[key].append(time.time())


def clear_attempts(bucket, key):
    bucket[key] = []


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            joined TEXT NOT NULL,
            plan TEXT DEFAULT 'Free'
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS saved_chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            html TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS usage_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            ts INTEGER NOT NULL,
            difficulty INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS password_resets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS action_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            label TEXT NOT NULL,
            text TEXT NOT NULL,
            source_text TEXT,
            created_at TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)

    # Lightweight migrations for columns added after these tables already
    # existed. SQLite has no "ADD COLUMN IF NOT EXISTS", so we try each one
    # and silently ignore the error if the column is already there. This
    # keeps init_db() safe to call every time the app starts.
    migrations = [
        "ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'dark'",
        "ALTER TABLE users ADD COLUMN font_size TEXT DEFAULT 'medium'",
        "ALTER TABLE users ADD COLUMN font_family TEXT DEFAULT 'sans'",
        "ALTER TABLE users ADD COLUMN sound_enabled INTEGER DEFAULT 1",
        "ALTER TABLE saved_chats ADD COLUMN project_id INTEGER",
        "ALTER TABLE projects ADD COLUMN notes TEXT DEFAULT ''",
    ]
    for m in migrations:
        try:
            conn.execute(m)
        except sqlite3.OperationalError:
            pass  # column already exists, fine

    conn.commit()
    conn.close()


init_db()


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return wrapper


# ---------- Pages ----------

@app.route('/')
@login_required
def home():
    return render_template('index.html', user_id=session['user_id'])


@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'GET':
        return render_template('signup.html')

    ip = _client_ip()
    if is_rate_limited(_signup_attempts, ip, SIGNUP_WINDOW_SECONDS, SIGNUP_MAX_ATTEMPTS):
        return render_template('signup.html', error="Too many accounts created from this network recently. Please try again later."), 429

    name = request.form.get('name', '').strip()
    email = request.form.get('email', '').strip().lower()
    password = request.form.get('password', '')

    if not name or not email or not password:
        return render_template('signup.html', error="All fields are required.")

    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        return render_template('signup.html', error="An account with that email already exists.")

    record_attempt(_signup_attempts, ip)

    password_hash = generate_password_hash(password)
    joined = datetime.now().strftime("%B %Y")

    conn.execute(
        "INSERT INTO users (name, email, password_hash, joined) VALUES (?, ?, ?, ?)",
        (name, email, password_hash, joined)
    )
    conn.commit()
    user = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    session['user_id'] = user['id']
    session.permanent = True
    return redirect(url_for('home'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template('login.html')

    ip = _client_ip()
    if is_rate_limited(_login_attempts, ip, LOGIN_WINDOW_SECONDS, LOGIN_MAX_ATTEMPTS):
        return render_template('login.html', error="Too many failed attempts. Please wait 15 minutes and try again."), 429

    email = request.form.get('email', '').strip().lower()
    password = request.form.get('password', '')
    remember = request.form.get('remember') == 'on'   # checkbox value is "on" only when checked

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    if user is None or not check_password_hash(user['password_hash'], password):
        record_attempt(_login_attempts, ip)
        return render_template('login.html', error="Invalid email or password.")

    clear_attempts(_login_attempts, ip)
    session['user_id'] = user['id']
    session.permanent = remember   # checked → 30-day persistent session; unchecked → clears on browser close
    return redirect(url_for('home'))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


# ---------- Forgot / reset password ----------
# No email service is configured yet, so instead of sending the reset
# link by mail, we generate it and display it directly on the page.
# Swapping in real email later only means replacing the "show it on
# screen" step below with an actual send-mail call — the token
# generation, expiry, and single-use logic stay exactly the same.

RESET_TOKEN_LIFETIME = timedelta(hours=1)
_reset_request_attempts = defaultdict(list)
RESET_REQUEST_WINDOW_SECONDS = 60 * 60
RESET_REQUEST_MAX_ATTEMPTS = 5


@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'GET':
        return render_template('forgot_password.html')

    ip = _client_ip()
    if is_rate_limited(_reset_request_attempts, ip, RESET_REQUEST_WINDOW_SECONDS, RESET_REQUEST_MAX_ATTEMPTS):
        return render_template('forgot_password.html', error="Too many requests. Please try again later."), 429
    record_attempt(_reset_request_attempts, ip)

    email = request.form.get('email', '').strip().lower()
    conn = get_db()
    user = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()

    reset_link = None
    if user:
        token = secrets.token_urlsafe(32)
        now = datetime.now()
        expires_at = now + RESET_TOKEN_LIFETIME
        conn.execute(
            "INSERT INTO password_resets (user_id, token, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (user['id'], token, now.isoformat(), expires_at.isoformat())
        )
        conn.commit()
        reset_link = url_for('reset_password', token=token, _external=True)

    conn.close()

    # Deliberately show the same message whether or not the email was
    # found, so this page can't be used to check which emails are
    # registered. The link (if any) only appears when the account exists.
    return render_template(
        'forgot_password.html',
        message="If that email is registered, a reset link is shown below.",
        reset_link=reset_link
    )


@app.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    conn = get_db()
    reset_row = conn.execute(
        "SELECT * FROM password_resets WHERE token = ?", (token,)
    ).fetchone()

    def token_is_valid(row):
        if row is None or row['used']:
            return False
        return datetime.now() < datetime.fromisoformat(row['expires_at'])

    if not token_is_valid(reset_row):
        conn.close()
        return render_template('reset_password.html', invalid=True)

    if request.method == 'GET':
        conn.close()
        return render_template('reset_password.html', token=token)

    new_password = request.form.get('new_password', '')
    confirm_password = request.form.get('confirm_password', '')

    if len(new_password) < 6:
        conn.close()
        return render_template('reset_password.html', token=token, error="Password must be at least 6 characters.")
    if new_password != confirm_password:
        conn.close()
        return render_template('reset_password.html', token=token, error="Passwords do not match.")

    new_hash = generate_password_hash(new_password)
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, reset_row['user_id']))
    conn.execute("UPDATE password_resets SET used = 1 WHERE id = ?", (reset_row['id'],))
    conn.commit()
    conn.close()

    return redirect(url_for('login'))


# ---------- Profile ----------

@app.route('/api/profile')
@login_required
def profile():
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (session['user_id'],)).fetchone()
    conn.close()
    return jsonify({
        "name": user["name"],
        "email": user["email"],
        "joined": user["joined"],
        "plan": user["plan"],
    })


# ---------- Settings ----------

@app.route('/api/settings', methods=['GET'])
@login_required
def get_settings():
    conn = get_db()
    user = conn.execute(
        "SELECT theme, font_size, font_family, sound_enabled FROM users WHERE id = ?",
        (session['user_id'],)
    ).fetchone()
    conn.close()
    return jsonify({
        "theme": user["theme"] or "dark",
        "font_size": user["font_size"] or "medium",
        "font_family": user["font_family"] or "sans",
        "sound_enabled": bool(user["sound_enabled"]),
    })


@app.route('/api/settings', methods=['POST'])
@login_required
def update_settings():
    data = request.json or {}
    fields, values = [], []

    if data.get('theme') in ('dark', 'light'):
        fields.append("theme = ?")
        values.append(data['theme'])
    if data.get('font_size') in ('small', 'medium', 'large'):
        fields.append("font_size = ?")
        values.append(data['font_size'])
    if data.get('font_family') in ('sans', 'serif', 'mono'):
        fields.append("font_family = ?")
        values.append(data['font_family'])
    if 'sound_enabled' in data:
        fields.append("sound_enabled = ?")
        values.append(1 if data['sound_enabled'] else 0)

    if not fields:
        return jsonify({"error": "No valid settings provided"}), 400

    values.append(session['user_id'])
    conn = get_db()
    conn.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route('/api/account/name', methods=['POST'])
@login_required
def update_name():
    data = request.json or {}
    new_name = data.get('name', '').strip()
    if not new_name:
        return jsonify({"error": "Name cannot be empty"}), 400

    conn = get_db()
    conn.execute("UPDATE users SET name = ? WHERE id = ?", (new_name, session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "name": new_name})


@app.route('/api/account/email', methods=['POST'])
@login_required
def update_email():
    data = request.json or {}
    new_email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not new_email or not password:
        return jsonify({"error": "New email and current password are required"}), 400

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (session['user_id'],)).fetchone()

    if not check_password_hash(user['password_hash'], password):
        conn.close()
        return jsonify({"error": "Current password is incorrect"}), 400

    existing = conn.execute(
        "SELECT id FROM users WHERE email = ? AND id != ?",
        (new_email, session['user_id'])
    ).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": "That email is already in use"}), 400

    conn.execute("UPDATE users SET email = ? WHERE id = ?", (new_email, session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "email": new_email})


@app.route('/api/account/password', methods=['POST'])
@login_required
def update_password():
    data = request.json or {}
    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')

    if not current_password or not new_password:
        return jsonify({"error": "Both current and new password are required"}), 400
    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (session['user_id'],)).fetchone()

    if not check_password_hash(user['password_hash'], current_password):
        conn.close()
        return jsonify({"error": "Current password is incorrect"}), 400

    new_hash = generate_password_hash(new_password)
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# ---------- Chat (bot) ----------

# Lightweight pattern-based detector for actionable phrases in what the
# user types — no LLM needed for this, just regexes looking for common
# "remind me", "todo", "follow up" style phrasing. Each match becomes a
# real row in action_items, tied to the user, that shows up live in the
# toolkit panel.
ACTION_ITEM_PATTERNS = [
    (re.compile(r"remind me to (.+?)(?:[.!?\n]|$)", re.IGNORECASE), "Reminder"),
    (re.compile(r"don'?t forget to (.+?)(?:[.!?\n]|$)", re.IGNORECASE), "Reminder"),
    (re.compile(r"\bi need to (.+?)(?:[.!?\n]|$)", re.IGNORECASE), "To-do"),
    (re.compile(r"\bi(?:'ll| will) need to (.+?)(?:[.!?\n]|$)", re.IGNORECASE), "To-do"),
    (re.compile(r"follow up on (.+?)(?:[.!?\n]|$)", re.IGNORECASE), "Follow-up"),
    (re.compile(r"\btodo:?\s+(.+?)(?:[.!?\n]|$)", re.IGNORECASE), "To-do"),
    (re.compile(r"make sure (?:to |i )?(.+?)(?:[.!?\n]|$)", re.IGNORECASE), "To-do"),
]
MAX_ACTION_TEXT_WORDS = 15


def extract_action_items(text):
    items = []
    seen = set()
    for pattern, label in ACTION_ITEM_PATTERNS:
        for m in pattern.finditer(text):
            phrase = m.group(1).strip().rstrip(',;: ')
            if not phrase:
                continue
            words = phrase.split()
            if len(words) > MAX_ACTION_TEXT_WORDS:
                phrase = ' '.join(words[:MAX_ACTION_TEXT_WORDS]) + '…'
            key = phrase.lower()
            if key in seen:
                continue
            seen.add(key)
            items.append((label, phrase))
    return items


@app.route('/api/chat', methods=['POST'])
@login_required
def chat():
    user_message = request.json.get('message', '')
    bot_response = generate_response(user_message)

    detected = extract_action_items(user_message)
    new_items = []
    if detected:
        conn = get_db()
        now = datetime.now().isoformat()
        for label, phrase in detected:
            conn.execute(
                "INSERT INTO action_items (user_id, label, text, source_text, created_at) VALUES (?, ?, ?, ?, ?)",
                (session['user_id'], label, phrase, user_message, now)
            )
        conn.commit()
        conn.close()
        new_items = [{"label": label, "text": phrase} for label, phrase in detected]

    return jsonify({"response": bot_response, "new_action_items": new_items})


def generate_response(user_message):
    try:
        response = client.chat.completions.create(
           model="openai/gpt-oss-120b",
            messages=[
                {"role":"system","content":SYSTEM_PROMPT},
                {"role":"user","content":user_message}
            ],
            temperature=0.7,
            max_tokens=1024
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Groq API Error: {e}"


# ---------- Action items ----------

@app.route('/api/action-items', methods=['GET'])
@login_required
def get_action_items():
    conn = get_db()
    rows = conn.execute(
        "SELECT id, label, text, completed, created_at FROM action_items WHERE user_id = ? ORDER BY completed ASC, id DESC",
        (session['user_id'],)
    ).fetchall()
    conn.close()
    return jsonify([
        {"id": r["id"], "label": r["label"], "text": r["text"],
         "completed": bool(r["completed"]), "created_at": r["created_at"]}
        for r in rows
    ])


@app.route('/api/action-items/<int:item_id>', methods=['PATCH'])
@login_required
def update_action_item(item_id):
    data = request.json or {}
    if 'completed' not in data:
        return jsonify({"error": "No valid field provided"}), 400

    conn = get_db()
    conn.execute(
        "UPDATE action_items SET completed = ? WHERE id = ? AND user_id = ?",
        (1 if data['completed'] else 0, item_id, session['user_id'])
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route('/api/action-items/<int:item_id>', methods=['DELETE'])
@login_required
def delete_action_item(item_id):
    conn = get_db()
    conn.execute(
        "DELETE FROM action_items WHERE id = ? AND user_id = ?",
        (item_id, session['user_id'])
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# ---------- Saved chats ----------

@app.route('/api/chats', methods=['GET'])
@login_required
def get_chats():
    project_id = request.args.get('project_id')
    conn = get_db()
    if project_id is not None:
        rows = conn.execute(
            "SELECT id, title, html, project_id FROM saved_chats WHERE user_id = ? AND project_id = ? ORDER BY id DESC",
            (session['user_id'], project_id)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, title, html, project_id FROM saved_chats WHERE user_id = ? ORDER BY id DESC",
            (session['user_id'],)
        ).fetchall()
    conn.close()
    return jsonify([
        {"id": r["id"], "title": r["title"], "html": r["html"], "project_id": r["project_id"]}
        for r in rows
    ])


@app.route('/api/chats', methods=['POST'])
@login_required
def save_chat():
    data = request.json or {}
    conn = get_db()
    conn.execute(
        "INSERT INTO saved_chats (user_id, title, html, created_at, project_id) VALUES (?, ?, ?, ?, ?)",
        (session['user_id'], data.get('title', 'Untitled chat'), data.get('html', ''),
         datetime.now().isoformat(), data.get('project_id'))
    )
    conn.commit()
    new_id = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
    conn.close()
    return jsonify({"id": new_id})


@app.route('/api/chats/<int:chat_id>', methods=['DELETE'])
@login_required
def delete_chat(chat_id):
    conn = get_db()
    conn.execute(
        "DELETE FROM saved_chats WHERE id = ? AND user_id = ?",
        (chat_id, session['user_id'])
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route('/api/chats/<int:chat_id>/project', methods=['PATCH'])
@login_required
def assign_chat_project(chat_id):
    data = request.json or {}
    project_id = data.get('project_id')  # may be None to unassign
    conn = get_db()
    conn.execute(
        "UPDATE saved_chats SET project_id = ? WHERE id = ? AND user_id = ?",
        (project_id, chat_id, session['user_id'])
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# ---------- Projects ----------

@app.route('/api/projects', methods=['GET'])
@login_required
def get_projects():
    conn = get_db()
    rows = conn.execute(
        """SELECT p.id, p.name,
                  (SELECT COUNT(*) FROM saved_chats c WHERE c.project_id = p.id) AS chat_count
           FROM projects p WHERE p.user_id = ? ORDER BY p.id DESC""",
        (session['user_id'],)
    ).fetchall()
    conn.close()
    return jsonify([{"id": r["id"], "name": r["name"], "chat_count": r["chat_count"]} for r in rows])


@app.route('/api/projects', methods=['POST'])
@login_required
def create_project():
    data = request.json or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({"error": "Project name is required"}), 400

    conn = get_db()
    conn.execute(
        "INSERT INTO projects (user_id, name, created_at) VALUES (?, ?, ?)",
        (session['user_id'], name, datetime.now().isoformat())
    )
    conn.commit()
    new_id = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
    conn.close()
    return jsonify({"id": new_id, "name": name, "chat_count": 0})


@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
@login_required
def delete_project(project_id):
    conn = get_db()
    # Unassign chats instead of deleting them — removing a folder
    # shouldn't destroy someone's saved conversations.
    conn.execute(
        "UPDATE saved_chats SET project_id = NULL WHERE project_id = ? AND user_id = ?",
        (project_id, session['user_id'])
    )
    conn.execute(
        "DELETE FROM projects WHERE id = ? AND user_id = ?",
        (project_id, session['user_id'])
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# ---------- Usage log ----------

@app.route('/api/usage', methods=['GET'])
@login_required
def get_usage():
    conn = get_db()
    rows = conn.execute(
        "SELECT ts, difficulty FROM usage_log WHERE user_id = ?",
        (session['user_id'],)
    ).fetchall()
    conn.close()
    return jsonify([{"ts": r["ts"], "difficulty": r["difficulty"]} for r in rows])


@app.route('/api/usage', methods=['POST'])
@login_required
def log_usage():
    data = request.json or {}
    conn = get_db()
    conn.execute(
        "INSERT INTO usage_log (user_id, ts, difficulty) VALUES (?, ?, ?)",
        (session['user_id'], data.get('ts'), data.get('difficulty'))
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})




if __name__ == '__main__':
    app.run(debug=True)
