const { Mistral } = require("@mistralai/mistralai");
const fs = require("fs");
const path = require("path");

const apiKey = process.env.apiKey;
const client = new Mistral({ apiKey });
const canartPath = path.join(__dirname, "../data/canart.json");
const jazzPath = path.join(__dirname, "../data/jazz.json");

const initCanartFile = () => {
  if (!fs.existsSync(path.dirname(canartPath))) {
    fs.mkdirSync(path.dirname(canartPath), { recursive: true });
  }
  if (!fs.existsSync(canartPath)) {
    fs.writeFileSync(canartPath, JSON.stringify({ users: {} }));
  }
};

const initJazzFile = () => {
  if (!fs.existsSync(path.dirname(jazzPath))) {
    fs.mkdirSync(path.dirname(jazzPath), { recursive: true });
  }
  if (!fs.existsSync(jazzPath)) {
    fs.writeFileSync(jazzPath, JSON.stringify({ conversations: {} }));
  }
};

const checkUserLimit = (userName) => {
  initCanartFile();
  const data = JSON.parse(fs.readFileSync(canartPath, "utf8"));
  if (!data.users[userName]) data.users[userName] = { count: 0 };
  return data.users[userName].count < 30;
};

const incrementUserCount = (userName) => {
  const data = JSON.parse(fs.readFileSync(canartPath, "utf8"));
  if (!data.users[userName]) data.users[userName] = { count: 0 };
  data.users[userName].count++;
  fs.writeFileSync(canartPath, JSON.stringify(data));
};

const saveConversation = (userName, displayName, userMessage, botResponse) => {
  initJazzFile();
  const data = JSON.parse(fs.readFileSync(jazzPath, "utf8"));

  if (!data.conversations[userName]) {
    data.conversations[userName] = {
      displayName: displayName,
      messages: [],
    };
  }

  data.conversations[userName].messages.push({
    timestamp: new Date().toISOString(),
    userMessage: userMessage,
    botResponse: botResponse,
  });

  fs.writeFileSync(jazzPath, JSON.stringify(data, null, 2));
};

const chat = async (message, userName, displayName) => {
  if (!checkUserLimit(userName)) {
    return {
      content:
        "Désolé, vous avez atteint votre limite de 30 requêtes. \nDemandez à Foucault de vous rajouter des requêtes pour continuer de discuter avec Jazz.",
      role: "assistant",
      limitReached: true,
    };
  }

  const response = await client.agents.complete({
    agentId: "ag:e0998804:20250319:alain:e7b42b8c",
    messages: [{ role: "user", content: message }],
  });

  incrementUserCount(userName);

  // Enregistrer la conversation
  saveConversation(
    userName,
    displayName,
    message,
    response.choices[0].message.content
  );

  return response.choices[0].message;
};

module.exports = { chat, checkUserLimit };
