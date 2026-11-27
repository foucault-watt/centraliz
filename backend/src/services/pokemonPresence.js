// Qui regarde et qui joue, en mémoire (pas de base de données).
// Suivi par appareil (une session = un navigateur), regroupé par personne
// à l'affichage :
// - un appareil regarde s'il a demandé une image dans les WATCHING_MS ms ;
// - il joue s'il a envoyé un bouton dans les PLAYING_MS ms.
// Deux onglets du même navigateur partagent la session : un seul appareil.

const WATCHING_MS = 6000;
const PLAYING_MS = 30000;

const devices = new Map(); // sessionId -> { userKey, name, type, seenAt, playedAt, lastButton }

function deviceType(userAgent = "") {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent) ? "mobile" : "desktop";
}

function deviceFor({ user, sessionId, userAgent }) {
  const userKey = user && user.userName;
  if (!userKey) return null;
  const key = sessionId || `${userKey}:${deviceType(userAgent)}`;
  let device = devices.get(key);
  if (!device) {
    device = { userKey, name: "", type: "desktop", seenAt: 0, playedAt: 0, lastButton: "" };
    devices.set(key, device);
  }
  device.userKey = userKey;
  device.name = user.displayName || user.userName;
  device.type = deviceType(userAgent);
  return device;
}

function noteWatching(context, now = Date.now()) {
  const device = deviceFor(context || {});
  if (device) device.seenAt = now;
}

function notePlaying(context, button, now = Date.now()) {
  const device = deviceFor(context || {});
  if (!device) return;
  device.seenAt = now;
  device.playedAt = now;
  device.lastButton = button;
}

function getPresence(now = Date.now()) {
  const people = new Map(); // userKey -> { name, devices, playedAt, lastButton }

  for (const [key, device] of devices) {
    const isPlaying = now - device.playedAt <= PLAYING_MS;
    const isWatching = now - device.seenAt <= WATCHING_MS;
    if (!isPlaying && !isWatching) {
      if (now - device.seenAt > PLAYING_MS) devices.delete(key);
      continue;
    }
    let person = people.get(device.userKey);
    if (!person) {
      person = { name: device.name, devices: [], playedAt: 0, lastButton: "" };
      people.set(device.userKey, person);
    }
    person.devices.push({ type: device.type, playing: isPlaying });
    if (isPlaying && device.playedAt > person.playedAt) {
      person.playedAt = device.playedAt;
      person.lastButton = device.lastButton;
      person.lastDevice = device.type;
    }
  }

  const playing = [];
  const watching = [];
  for (const person of people.values()) {
    // Téléphones d'abord, puis ordinateurs : un ordre stable à l'écran.
    const deviceList = person.devices
      .sort((a, b) => a.type.localeCompare(b.type) * -1)
      .map(({ type, playing: p }) => ({ type, playing: p }));
    if (person.playedAt) {
      playing.push({
        name: person.name,
        devices: deviceList,
        lastButton: person.lastButton,
        lastDevice: person.lastDevice,
        secondsAgo: Math.round((now - person.playedAt) / 1000),
      });
    } else {
      watching.push({ name: person.name, devices: deviceList });
    }
  }
  playing.sort((a, b) => a.secondsAgo - b.secondsAgo);
  watching.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return { success: true, playing, watching };
}

function resetForTests() {
  devices.clear();
}

module.exports = { noteWatching, notePlaying, getPresence, deviceType, resetForTests, WATCHING_MS, PLAYING_MS };
