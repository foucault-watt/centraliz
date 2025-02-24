import React, { useEffect, useRef, useState } from "react";

const Bdi = () => {
  const canvasRef = useRef(null);
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem("dinoHighScore");
    return saved ? parseInt(saved) : 0;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let scoreInterval = 0;
    let frameInterval = 0;
    let groundscroll = 0;
    let groundscroll2 = 0;
    let tempstart = 0;
    let groundbool = false;
    let frame = 0;
    let bool = false;
    const grav = 0.6;
    let gamespeed = 0;
    let onG = false;

    const p = {
      x: 100,
      y: 500,
      w: 89,
      h: 94,
      yv: 0,
      score: 0,
      hscore: 0,
      jump: 15,
    };

    const obsS = {
      x: 20,
      y: 230,
      w: 34,
      h: 70,
      scroll: -100,
      on: false,
    };

    const obsB = {
      x: 20,
      y: 201,
      w: 49,
      h: 100,
      scroll: -200,
      on: false,
    };

    const pbox = {
      x: p.x,
      y: 0,
      w: 80,
      h: 75,
    };

    let multiS = -1;
    let picS = 0;
    let multiB = -1;
    let picB = 0;

    const sprImg = new Image();
    sprImg.src = process.env.PUBLIC_URL + "/sprite-leo-grey.png";

    const plat = {
      x: 0,
      y: canvas.height - 100,
      w: canvas.width,
      h: 5,
    };

    function update() {
      if (!onG) {
        p.yv += grav;
      }

      p.y += p.yv;
      pbox.y = p.y;
      scoreInterval++;
      if (scoreInterval > 6 && gamespeed !== 0) {
        p.score++;
        scoreInterval = 0;
      }

      if (gamespeed < 2000 && gamespeed !== 0) {
        // Augmenté de 17 à 25 pour une vitesse max plus élevée
        gamespeed = 10 + p.score / 15; // Vitesse initiale de 10 au lieu de 7, et accélération plus rapide (divisé par 80 au lieu de 100)
      }

      onG = false;
      if (p.y + p.h > plat.y) {
        p.y = plat.y - p.h;
        onG = true;
      }

      if (
        pbox.x > canvas.width - obsB.scroll - p.w &&
        pbox.x < canvas.width - obsB.scroll + obsB.w * multiB &&
        pbox.y > obsB.y - pbox.h
      ) {
        gameover();
      }

      if (
        pbox.x > canvas.width - obsS.scroll - p.w &&
        pbox.x < canvas.width - obsS.scroll + obsS.w * multiS &&
        pbox.y > obsS.y - pbox.h
      ) {
        gameover();
      }

      frameInterval++;
      if (frameInterval > 15) {
        bool = !bool;
        frameInterval = 0;
      }

      if (bool && onG) {
        frame = 1514;
      } else if (!bool && onG) {
        frame = 1602;
      } else {
        frame = 1338;
      }

      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      groundscroll += gamespeed;
      ctx.drawImage(
        sprImg,
        0,
        104,
        2404,
        18,
        0 - groundscroll + tempstart,
        plat.y - 24,
        2404,
        18
      );

      if (groundscroll - tempstart > 2404 - canvas.width || groundbool) {
        groundbool = true;
        groundscroll2 += gamespeed;
        ctx.drawImage(
          sprImg,
          0,
          104,
          canvas.width,
          18,
          0 - groundscroll2 + canvas.width,
          plat.y - 24,
          canvas.width,
          18
        );

        if (groundscroll2 > canvas.width && groundscroll - tempstart > 1000) {
          tempstart = canvas.width;
          groundscroll = 20;
        }
        if (groundscroll2 > 2402) {
          groundscroll2 = 0;
          groundbool = false;
        }
      }

      if (gamespeed !== 0) {
        ctx.drawImage(sprImg, frame, 0, 88, 94, p.x, p.y, p.w, p.h);
      } else {
        ctx.drawImage(sprImg, 1338, 0, 88, 94, p.x, p.y, p.w, p.h);
      }

      if (!obsB.on) {
        obsS.on = true;
        if (multiS === -1) {
          rngS();
        }

        ctx.drawImage(
          sprImg,
          picS,
          2,
          obsS.w * multiS,
          obsS.h,
          canvas.width - obsS.scroll,
          obsS.y,
          obsS.w * multiS,
          obsS.h
        );
        obsS.scroll += gamespeed;
        if (obsS.scroll > canvas.width + obsS.w * 3) {
          obsS.scroll = -100;
          multiS = -1;
          obsS.on = false;
        }
      }

      if (!obsS.on) {
        obsB.on = true;
        if (multiB === -1) {
          rngB();
        }

        ctx.drawImage(
          sprImg,
          652,
          2,
          obsB.w * multiB,
          obsB.h,
          canvas.width - obsB.scroll,
          obsB.y,
          obsB.w * multiB,
          obsB.h
        );
        obsB.scroll += gamespeed;
        if (obsB.scroll > canvas.width + obsB.w * 3) {
          obsB.scroll = -200;
          multiB = -1;
          obsB.on = false;
        }
      }

      ctx.font = "20px verdana";
      ctx.fillStyle = "black";
      ctx.fillText("Score: ", 100, canvas.height - 40);
      ctx.fillText(p.score, 170, canvas.height - 40);
    }

    function showGameOverMessage() {
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "white";
      ctx.font = "48px verdana";
      ctx.fillText(
        "Game Over!",
        canvas.width / 2 - 120,
        canvas.height / 2 - 50
      );

      ctx.font = "24px verdana";
      ctx.fillText(
        `Score: ${finalScore}`,
        canvas.width / 2 - 60,
        canvas.height / 2
      );
      ctx.fillText(
        `High Score: ${highScore}`,
        canvas.width / 2 - 80,
        canvas.height / 2 + 40
      );
      ctx.fillText(
        "Click or Press ↑ to restart",
        canvas.width / 2 - 140,
        canvas.height / 2 + 80
      );
    }

    function gameover() {
      gamespeed = 0;
      const newScore = p.score;
      setFinalScore(newScore);

      if (newScore > highScore) {
        setHighScore(newScore);
        localStorage.setItem("dinoHighScore", newScore.toString());
      }

      setGameOver(true);
      showGameOverMessage();

      p.score = 0;
      obsB.scroll = -200;
      obsS.scroll = -100;

      scoreInterval = 0;
      frameInterval = 0;
      groundscroll = 0;
      groundscroll2 = 0;
      tempstart = 0;
      groundbool = false;
      multiS = -1;
      multiB = -1;
    }

    function rngS() {
      multiS = Math.floor(Math.random() * 3) + 1;
      picS = 446 + Math.floor(Math.random() * 2) * 102;
    }

    function rngB() {
      multiB = Math.floor(Math.random() * 3) + 1;
      picB = 652 + Math.floor(Math.random() * 2) * 150;
    }

    const startGame = () => {
      if (gamespeed === 0) {
        setGameOver(false);
        gamespeed = 10; // Vitesse initiale augmentée de 7 à 10
      }
    };

    const handleKeyDown = (evt) => {
      evt.preventDefault();
      if (evt.keyCode === 38) {
        if (onG) {
          p.yv = -p.jump;
        }
        startGame();
      }
    };

    const handleClick = () => {
      if (onG) {
        p.yv = -p.jump;
      }
      startGame();
    };

    const handleCanvasClick = (e) => {
      e.preventDefault();
      handleClick();
    };

    // Prevent scrolling with arrow keys
    const preventScroll = (e) => {
      if (e.keyCode === 38 || e.keyCode === 40) {
        e.preventDefault();
      }
    };

    canvas.addEventListener("click", handleCanvasClick);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keydown", preventScroll);

    const gameLoop = setInterval(() => {
      update();
      if (gameOver) {
        showGameOverMessage();
      }
    }, 1000 / 60);

    return () => {
      canvas.removeEventListener("click", handleCanvasClick);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keydown", preventScroll);
      clearInterval(gameLoop);
    };
  }, [gameOver, finalScore, highScore]);

  return (
    <div className="bdi-container">
      <div className="bdi-layout">
        <div className="game-section">
          <canvas
            ref={canvasRef}
            width="1000"
            height="400"
            style={{ background: "white", cursor: "pointer" }}
            tabIndex="0"
          />
        </div>
      </div>
    </div>
  );
};

export default Bdi;
