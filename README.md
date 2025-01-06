# LearnLink-BE

LearnLink ist eine Backend-Anwendung, die eine Basis für die Verwaltung von Benutzern, Authentifizierung und Kontaktformularanfragen bietet. Sie basiert auf Node.js, Express und SQLite und beinhaltet wichtige Funktionen wie JWT-Authentifizierung, Registrieren und Login.

## Inhaltsverzeichnis

- [Installation](#installation)
- [Verwendung](#verwendung)
- [API Endpoints](#api-endpoints)
- [Datenbank](#datenbank)
- [Projektstruktur](#projektstruktur)

---

## Installation

1. Klone das Repository:

   ```bash
   git clone <repository-url>
   cd LearnLink
   ```

2. Installiere die Abhängigkeiten:

   ```bash
   npm install express sqlite3 body-parser cors bcrypt jsonwebtoken
   ```

3. Stelle sicher, dass die SQLite-Datenbank ordnungsgemäß eingerichtet ist. Standardmäßig wird die Datenbank unter `databases/user.db` erstellt.

---

## Verwendung

1. Starte das Backend:

   ```bash
   cd backend
   node .\server.js
   ```

2. Der Server wird unter `http://localhost:5000` gestartet.

---

npm install multer
npm install axios
npm install jwt-decode

## API Endpoints

### Öffentliche Endpoints

- **`GET /api/message`**

  - **Beschreibung:** Gibt eine Begrüßungsnachricht zurück.
  - **Antwort:**
    ```json
    { "message": "Hello from the backend!" }
    ```

- **`POST /register`**

  - **Beschreibung:** Registriert einen neuen Benutzer.
  - **Anfrage:**
    ```json
    {
      "username": "testuser",
      "email": "test@example.com",
      "password": "securepassword",
      "role": "student",
      "birthDate": "2000-01-01"
    }
    ```
  - **Antwort:** Erfolgreiche Registrierung gibt die Benutzerinformationen zurück.

- **`POST /login`**
  - **Beschreibung:** Loggt einen Benutzer ein und gibt ein JWT zurück.
  - **Anfrage:**
    ```json
    {
      "username": "testuser",
      "password": "securepassword"
    }
    ```
  - **Antwort:**
    ```json
    {
      "id": 1,
      "username": "testuser",
      "email": "test@example.com",
      "role": "student",
      "birthDate": "2000-01-01",
      "token": "<JWT_TOKEN>"
    }
    ```

### Geschützte Endpoints

- **`GET /api/protected`**
  - **Beschreibung:** Zugriff nur mit einem gültigen JWT-Token.
  - **Antwort:** Gibt geschützte Daten zurück.

### Kontaktformular

- **`POST /contact`**
  - **Beschreibung:** Speichert eine Kontaktanfrage.
  - **Anfrage:**
    ```json
    {
      "name": "John Doe",
      "email": "john@example.com",
      "message": "Hello, I have a question."
    }
    ```
  - **Antwort:**
    ```json
    { "message": "Contact request saved successfully!" }
    ```

---

## Datenbank

Die Anwendung verwendet SQLite als Datenbank. Die Datenbank wird bei jedem Start überprüft, und Tabellen werden bei Bedarf erstellt.

### Tabellen:

1. **`users`**

   - `id`: Primärschlüssel
   - `username`: Eindeutiger Benutzername
   - `email`: E-Mail-Adresse des Benutzers
   - `password`: Gehashtes Passwort
   - `role`: Benutzerrolle (Standard: `student`)
   - `birthDate`: Geburtsdatum des Benutzers

2. **`contact_requests`**
   - `id`: Primärschlüssel
   - `name`: Name des Absenders
   - `email`: E-Mail-Adresse des Absenders
   - `message`: Nachricht
   - `date`: Eingabedatum (Standard: aktuelles Datum)

---

## Projektstruktur

```
LearnLink/
├── backend/
│   ├── server.js         # Hauptserver-Datei
│   ├── database.js       # SQLite-Datenbank-Setup
│   ├── databases/
│       └── user.db       # SQLite-Datenbankdatei
├── README.md             # Dokumentation
```

---

## Sicherheit

- Die Passwörter werden mit **bcrypt** gehasht.
- Authentifizierung erfolgt über **JWT (JSON Web Token)**.

---

## Lizenz

Dieses Projekt steht unter der [MIT-Lizenz](LICENSE).

---

## Kontakt

Falls du Fragen hast, kannst du dich gerne melden: `deine-email@example.com`
