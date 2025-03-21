import React, { useEffect, useRef, useState } from "react";
import "../styles/Alain.scss";

export default function Alain() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null); // Nouvelle référence pour le conteneur de messages
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false);

  // Effet pour le défilement automatique uniquement si nécessaire
  useEffect(() => {
    if (shouldScrollToBottom) {
      scrollToBottom();
      setShouldScrollToBottom(false);
    }
  }, [shouldScrollToBottom]);

  // Message d'accueil au montage du composant
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          text: "Hey, je suis Jazz le Pégase ! Comment puis-je t'aider aujourd'hui ? ✨",
          sender: "bot",
        },
      ]);
    }
  }, [messages.length]);

  // Méthode de défilement mise à jour pour scroller uniquement dans le conteneur de messages
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const newMessage = { text: input, sender: "user" };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setIsLoading(true);
    // Activer le défilement après l'ajout d'un message
    setShouldScrollToBottom(true);

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
      // Activer le défilement après réception de la réponse
      setShouldScrollToBottom(true);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { text: "Une erreur est survenue", sender: "error" },
      ]);
      // Activer le défilement même en cas d'erreur
      setShouldScrollToBottom(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour formater le texte avec des retours à la ligne et mettre en gras les textes entre **
  const formatMessageText = (text) => {
    if (!text) return null;

    // Utiliser une regex pour trouver les textes entre **
    const parts = text.split(/(\*\*[^*]+\*\*)/g);

    return parts.map((part, index) => {
      // Vérifier si cette partie est entourée de **
      if (part.startsWith("**") && part.endsWith("**")) {
        // Extraire le texte entre ** pour l'afficher en gras
        const boldText = part.slice(2, -2);
        return <strong key={index}>{boldText}</strong>;
      } else {
        // Gestion normale des sauts de ligne pour le texte ordinaire
        return part.split("\n").map((line, i) => (
          <React.Fragment key={`${index}-${i}`}>
            {line}
            {i < part.split("\n").length - 1 && <br />}
          </React.Fragment>
        ));
      }
    });
  };

  return (
    <div className="chat-container">
      <div className="messages" ref={messagesContainerRef}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.sender}`}>
            {formatMessageText(msg.text)}
          </div>
        ))}
        {isLoading && (
          <div className="loading-message">
            <div className="loading-animation">
              <div></div>
              <div></div>
              <div></div>
            </div>
          </div>
        )}
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
