const Client = require("ssh2-sftp-client");
require("dotenv").config();
const cliProgress = require("cli-progress");
const colors = require("colors");
const ora = require("ora");
const fs = require("fs");
const path = require("path");

const sftp = new Client();

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

async function deploy() {
  console.log(colors.bold.cyan("=== DÉPLOIEMENT CENTRALIZ ===\n"));

  const spinner = ora("Connexion au serveur SFTP...").start();

  try {
    await sftp.connect({
      host: process.env.SFTP_HOST,
      port: 8887,
      username: process.env.SFTP_USER,
      password: process.env.SFTP_PASSWORD,
    });

    spinner.succeed(colors.green("Connexion SFTP établie avec succès"));

    const remoteDir = process.env.SFTP_REMOTE_PATH;

    // Supprimer le dossier distant et son contenu
    const cleaningSpinner = ora(
      `Nettoyage du répertoire distant ${colors.yellow(remoteDir)}...`
    ).start();
    try {
      await sftp.rmdir(remoteDir, true); // `true` force la suppression récursive
      cleaningSpinner.succeed(
        colors.green(
          `Répertoire distant ${colors.yellow(remoteDir)} supprimé avec succès`
        )
      );
    } catch (err) {
      cleaningSpinner.warn(
        colors.yellow(
          `Le répertoire distant ${colors.yellow(
            remoteDir
          )} n'existe pas ou ne peut pas être supprimé`
        )
      );
    }

    // Recréer le dossier pour éviter les erreurs si nécessaire
    const mkdirSpinner = ora(
      `Création du répertoire distant ${colors.yellow(remoteDir)}...`
    ).start();
    await sftp.mkdir(remoteDir, true);
    mkdirSpinner.succeed(
      colors.green(
        `Répertoire distant ${colors.yellow(remoteDir)} créé avec succès`
      )
    );

    // Envoyer les nouveaux fichiers
    const uploadSpinner = ora(
      "Préparation du transfert des fichiers..."
    ).start();

    // Obtenir la liste des fichiers à transférer pour la barre de progression
    const localDir = "./frontend/build";
    const fileList = getAllFiles(localDir);
    uploadSpinner.succeed(
      colors.green(`${fileList.length} fichiers prêts à être transférés`)
    );

    // Barre de progression pour le téléversement
    const progressBar = new cliProgress.SingleBar({
      format:
        colors.cyan("Téléversement ") +
        "[{bar}] {percentage}% | {value}/{total} fichiers | {file}",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    });

    let uploadedFiles = 0;
    progressBar.start(fileList.length, 0, {
      file: "Initialisation...",
    });

    sftp.on("upload", (info) => {
      uploadedFiles++;
      progressBar.update(uploadedFiles, {
        file: info.source
          ? info.source.substring(info.source.lastIndexOf("/") + 1)
          : "",
      });
    });

    await sftp.uploadDir(localDir, remoteDir);
    progressBar.stop();

    console.log("\n" + colors.bold.green("✔ Déploiement terminé avec succès!"));
    console.log(colors.gray(`Heure: ${new Date().toLocaleString()}`));
  } catch (err) {
    console.error("\n" + colors.bold.red("✘ Erreur lors du déploiement:"));
    console.error(colors.red(err.message));

    if (err.code) {
      console.error(colors.yellow(`Code d'erreur: ${err.code}`));
    }
  } finally {
    await sftp.end();
    console.log(colors.gray("\nConnexion SFTP fermée."));
  }
}

deploy();
