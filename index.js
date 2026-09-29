<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>YOUR BRAND - Premium Access</title>

  <link rel="stylesheet" href="style.css">
</head>

<body>

  <div class="glow glow-1"></div>
  <div class="glow glow-2"></div>

  <main class="container">

    <!-- STATUS -->
    <div class="status">
      <span></span>
      LIVE ACCESS AVAILABLE
    </div>

    <!-- HERO -->
    <section class="hero">

      <div class="logo-box">
        <img src="assets/logo.png" alt="Logo">
      </div>

      <p class="welcome">WELCOME TO</p>

      <h1>YOUR <strong>BRAND</strong></h1>

      <p class="subtitle">
        Premium access with fast and simple registration.
      </p>

      <!-- PRICE -->
      <div class="price">
        <span class="old-price">₹1999</span>
        <span class="new-price">₹499</span>
      </div>

      <div class="offer">
        LIMITED TIME OFFER
      </div>

      <!-- BUTTONS -->
      <div class="buttons">

        <!-- REGISTRATION LINK -->
        <a
          href="https://example.com/register"
          target="_blank"
          rel="noopener noreferrer"
          class="button register">
          <b>REGISTER NOW</b>
          <small>Create your account</small>
        </a>

        <!-- DOWNLOAD -->
        <a
          href="downloads/app.apk"
          download
          class="button download">
          <b>DOWNLOAD APP</b>
          <small>Download the official application</small>
        </a>

      </div>

    </section>

    <!-- FEATURES -->
    <section class="features">

      <div class="card">
        <div class="icon">👑</div>
        <h3>Premium Access</h3>
        <p>Access premium features from one place.</p>
      </div>

      <div class="card">
        <div class="icon">🛡️</div>
        <h3>Secure</h3>
        <p>Use official registration and download links.</p>
      </div>

      <div class="card">
        <div class="icon">⚡</div>
        <h3>Fast Access</h3>
        <p>Simple and fast access on mobile devices.</p>
      </div>

    </section>

    <!-- COUNTDOWN -->
    <section class="countdown-box">

      <p>OFFER EXPIRES IN</p>

      <div class="countdown">

        <div>
          <b id="hours">24</b>
          <small>HOURS</small>
        </div>

        <span>:</span>

        <div>
          <b id="minutes">00</b>
          <small>MINUTES</small>
        </div>

        <span>:</span>

        <div>
          <b id="seconds">00</b>
          <small>SECONDS</small>
        </div>

      </div>

    </section>

    <!-- STATS -->
    <section class="stats">

      <div>
        <b>24/7</b>
        <small>ACCESS</small>
      </div>

      <div>
        <b>FAST</b>
        <small>ACCESS</small>
      </div>

      <div>
        <b>OFFICIAL</b>
        <small>LINKS</small>
      </div>

    </section>

    <!-- TELEGRAM -->
    <section class="telegram">

      <div class="telegram-icon">✈️</div>

      <h2>Join Our Community</h2>

      <p>
        Get the latest announcements and updates.
      </p>

      <a
        href="https://t.me/yourchannel"
        target="_blank"
        rel="noopener noreferrer">
        JOIN TELEGRAM
      </a>

    </section>

    <!-- FOOTER -->
    <footer>
      © 2026 YOUR BRAND. All rights reserved.
    </footer>

  </main>

  <script src="script.js"></script>

</body>
</html>
```

 ### `style.css`

```
:root {
  --primary: #8b5cf6;
  --secondary: #06b6d4;
  --green: #22c55e;

  --bg: #05050a;
  --card: rgba(20, 20, 32, 0.8);
  --border: rgba(255,255,255,0.1);

  --white: #ffffff;
  --muted: #a5a5b3;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  min-height: 100vh;

  background:
    radial-gradient(
      circle at 50% 0%,
      rgba(139,92,246,0.28),
      transparent 35%
    ),
    var(--bg);

  color: var(--white);

  font-family: Arial, sans-serif;

  overflow-x: hidden;
}

.container {
  width: min(900px, calc(100% - 30px));

  margin: auto;

  padding: 30px 0;
}

/* GLOW */

.glow {
  position: fixed;

  width: 300px;
  height: 300px;

  border-radius: 50%;

  filter: blur(120px);

  opacity: .2;

  pointer-events: none;
}

.glow-1 {
  background: var(--primary);

  top: 10%;
  left: -150px;
}

.glow-2 {
  background: var(--secondary);

  right: -150px;
  bottom: 10%;
}

/* STATUS */

.status {
  width: max-content;

  margin: auto;

  padding: 8px 15px;

  border-radius: 50px;

  background: rgba(34,197,94,.08);

  border: 1px solid rgba(34,197,94,.25);

  color: #86efac;

  font-size: 12px;

  font-weight: bold;
}

.status span {
  display: inline-block;

  width: 7px;
  height: 7px;

  margin-right: 7px;

  background: var(--green);

  border-radius: 50%;

  box-shadow: 0 0 12px var(--green);
}

/* HERO */

.hero {
  text-align: center;

  padding: 45px 0;
}

.logo-box {
  width: 110px;
  height: 110px;

  margin: auto auto 20px;

  display: flex;

  align-items: center;
  justify-content: center;

  border-radius: 25px;

  background: rgba(255,255,255,.05);

  border: 1px solid var(--border);

  box-shadow:
    0 0 40px rgba(139,92,246,.25);

  overflow: hidden;
}

.logo-box img {
  width: 80%;
  height: 80%;

  object-fit: contain;
}

.welcome {
  color: var(--muted);

  font-size: 12px;

  letter-spacing: 3px;

  margin-bottom: 10px;
}

h1 {
  font-size: clamp(42px, 8vw, 75px);

  line-height: 1;

  letter-spacing: -3px;
}

h1 strong {
  background:
    linear-gradient(
      90deg,
      var(--primary),
      var(--secondary)
    );

  -webkit-background-clip: text;

  background-clip: text;

  color: transparent;
}

.subtitle {
  max-width: 550px;

  margin: 20px auto;

  color: var(--muted);

  line-height: 1.6;
}

/* PRICE */

.price {
  display: flex;

  justify-content: center;
  align-items: center;

  gap: 15px;

  margin-top: 25px;
}

.old-price {
  color: #777;

  text-decoration: line-through;

  font-size: 18px;
}

.new-price {
  color: var(--green);

  font-size: 40px;

  font-weight: bold;
}

.offer {
  display: inline-block;

  margin-top: 8px;

  padding: 5px 12px;

  border-radius: 50px;

  background: rgba(34,197,94,.1);

  color: #86efac;

  font-size: 10px;

  font-weight: bold;
}

/* BUTTONS */

.buttons {
  max-width: 470px;

  margin: 30px auto 0;

  display: grid;

  gap: 12px;
}

.button {
  min-height: 65px;

  padding: 12px;

  border-radius: 15px;

  display: flex;

  flex-direction: column;

  justify-content: center;

  align-items: center;

  text-decoration: none;

  color: white;

  transition: .25s;
}

.button b {
  font-size: 16px;
}

.button small {
  margin-top: 5px;

  font-size: 11px;

  opacity: .7;
}

.register {
  background:
    linear-gradient(
      135deg,
      var(--primary),
      #c026d3
    );

  box-shadow:
    0 12px 35px rgba(139,92,246,.3);
}

.download {
  background: rgba(255,255,255,.05);

  border: 1px solid var(--border);
}

.button:hover {
  transform: translateY(-3px);
}

/* FEATURES */

.features {
  display: grid;

  grid-template-columns: repeat(3, 1fr);

  gap: 15px;
}

.card {
  padding: 25px 18px;

  text-align: center;

  background: var(--card);

  border: 1px solid var(--border);

  border-radius: 18px;

  transition: .25s;
}

.card:hover {
  transform: translateY(-4px);

  border-color: var(--primary);
}

.icon {
  font-size: 28px;

  margin-bottom: 12px;
}

.card h3 {
  font-size: 15px;

  margin-bottom: 8px;
}

.card p {
  color: var(--muted);

  font-size: 12px;

  line-height: 1.6;
}

/* COUNTDOWN */

.countdown-box {
  margin-top: 20px;

  padding: 35px 20px;

  text-align: center;

  border-radius: 20px;

  background: rgba(139,92,246,.08);

  border: 1px solid var(--border);
}

.countdown-box > p {
  color: var(--muted);

  font-size: 11px;

  letter-spacing: 2px;

  margin-bottom: 18px;
}

.countdown {
  display: flex;

  align-items: center;

  justify-content: center;

  gap: 12px;
}

.countdown div {
  display: flex;

  flex-direction: column;
}

.countdown b {
  font-size: 35px;
}

.countdown small {
  margin-top: 5px;

  color: var(--muted);

  font-size: 8px;
}

.countdown > span {
  font-size: 30px;

  color: var(--primary);
}

/* STATS */

.stats {
  display: grid;

  grid-template-columns: repeat(3, 1fr);

  margin-top: 20px;

  border-radius: 18px;

  overflow: hidden;

  border: 1px solid var(--border);

  background: rgba(255,255,255,.03);
}

.stats div {
  padding: 22px;
```
