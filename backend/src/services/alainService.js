const { Mistral } = require("@mistralai/mistralai");
const fs = require("fs");
const path = require("path");

const apiKey = process.env.apiKey;
const client = new Mistral({ apiKey });
const canartPath = path.join(__dirname, "../data/canart.json");

const initCanartFile = () => {
  if (!fs.existsSync(path.dirname(canartPath))) {
    fs.mkdirSync(path.dirname(canartPath), { recursive: true });
  }
  if (!fs.existsSync(canartPath)) {
    fs.writeFileSync(canartPath, JSON.stringify({ users: {} }));
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

const chat = async (message, userName) => {
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
  return response.choices[0].message;
};

module.exports = { chat, checkUserLimit };
