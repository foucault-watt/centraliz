import React, { useRef, useState } from "react";
import "../styles/Alain.scss";

export default function Alain() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const newMessage = { text: input, sender: "user" };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_BACK}/api/alain/chat`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: input }),
        }
      );

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          text: data.content,
          sender: data.limitReached ? "limit" : "bot",
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { text: "Une erreur est survenue", sender: "error" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour formater le texte avec des retours à la ligne
  const formatMessageText = (text) => {
    return text.split("\n").map((line, i) => (
      <React.Fragment key={i}>
        {line}
        <br />
      </React.Fragment>
    ));
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.sender}`}>
            {formatMessageText(msg.text)}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Posez votre question..."
          disabled={isLoading}
        />
        <button onClick={sendMessage} disabled={isLoading}>
          {isLoading ? "..." : "Envoyer"}
        </button>
      </div>
    </div>
  );
}
