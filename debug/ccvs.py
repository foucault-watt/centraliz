import requests
from bs4 import BeautifulSoup
import os
import sys

# Désactiver les avertissements SSL
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Variables de configuration
BASE_URL = "https://webaurion.centralelille.fr"
LOGIN_URL = f"{BASE_URL}/faces/Login.xhtml"
MAIN_MENU_URL = f"{BASE_URL}/faces/MainMenuPage.xhtml"
CHOIX_DONNEE_URL = f"{BASE_URL}/faces/ChoixDonnee.xhtml"
DOWNLOAD_DIR = "downloads"

# Demander les identifiants de l'utilisateur
USERNAME = input("Entrez votre nom d'utilisateur : ")
PASSWORD = input("Entrez votre mot de passe : ")

# Créer le répertoire de téléchargement s'il n'existe pas
if not os.path.exists(DOWNLOAD_DIR):
    os.makedirs(DOWNLOAD_DIR)

# Initialiser une session pour gérer les cookies
session = requests.Session()

# En-têtes HTTP communs
headers = {
    "User-Agent": "Mozilla/5.0",
    "Accept-Language": "fr",
    "Connection": "keep-alive"
}

def extract_form_data(html_content):
    """Extrait tous les champs du formulaire depuis le contenu HTML."""
    soup = BeautifulSoup(html_content, "html.parser")
    form = soup.find("form")
    if not form:
        return {}
    data = {}
    inputs = form.find_all("input")
    for input in inputs:
        name = input.get("name")
        value = input.get("value", "")
        if name:
            data[name] = value
    selects = form.find_all("select")
    for select in selects:
        name = select.get("name")
        if name:
            options = select.find_all("option")
            for option in options:
                if "selected" in option.attrs:
                    data[name] = option.get("value", "")
                    break
    return data

def get_form_action(html_content):
    """Extrait l'action du formulaire."""
    soup = BeautifulSoup(html_content, "html.parser")
    form = soup.find("form")
    if form:
        action = form.get("action")
        return action
    return None

try:
    # 1. Accéder à la page de connexion pour obtenir les champs initiaux
    print("1. Accès à la page de connexion...")
    response = session.get(LOGIN_URL, headers=headers, verify=False)
    response.raise_for_status()
    login_form_data = extract_form_data(response.text)
    form_action = get_form_action(response.text)
    if not login_form_data:
        print("Erreur : Formulaire de connexion introuvable.")
        exit(1)
    if not form_action:
        print("Erreur : Action du formulaire de connexion introuvable.")
        exit(1)
    login_url = BASE_URL + form_action

    # 2. Préparer les données du formulaire de connexion
    print("2. Préparation des données de connexion...")
    login_form_data.update({
        "username": USERNAME,
        "password": PASSWORD,
    })

    # 3. Soumettre le formulaire de connexion
    print("3. Soumission du formulaire de connexion...")
    response = session.post(login_url, data=login_form_data, headers=headers, allow_redirects=False, verify=False)
    if response.status_code != 302 or 'Location' not in response.headers:
        print("Erreur : échec de la connexion.")
        exit(1)

    # 4. Suivre la redirection après connexion
    print("4. Redirection après connexion...")
    redirect_url = response.headers['Location']
    if not redirect_url.startswith("http"):
        redirect_url = BASE_URL + redirect_url
    response = session.get(redirect_url, headers=headers, verify=False)
    response.raise_for_status()

    # 5. Accéder au menu principal et extraire les champs du formulaire
    print("5. Accès au menu principal...")
    response = session.get(MAIN_MENU_URL, headers=headers, verify=False)
    response.raise_for_status()
    menu_form_data = extract_form_data(response.text)
    if not menu_form_data:
        print("Erreur : Formulaire du menu principal introuvable.")
        exit(1)
    menu_form_action = get_form_action(response.text)
    if not menu_form_action:
        print("Erreur : Action du formulaire du menu principal introuvable.")
        exit(1)
    menu_url = BASE_URL + menu_form_action

    # 6. Préparer les données pour naviguer vers la page de téléchargement
    print("6. Préparation des données pour accéder à la page de téléchargement...")
    # Mettre à jour les champs nécessaires du formulaire
    menu_form_data.update({
        "javax.faces.ViewState": menu_form_data.get("javax.faces.ViewState", ""),
        "form:sidebar": "form:sidebar",
        "form:sidebar_menuid": "1_0_0",  # Ajustez cet ID en fonction de la structure du menu
    })

    # 7. Soumettre le formulaire du menu principal
    print("7. Navigation vers la page de téléchargement...")
    response = session.post(menu_url, data=menu_form_data, headers=headers, verify=False)
    response.raise_for_status()

    # 8. Accéder à la page de choix des données et extraire les champs
    print("8. Accès à la page de téléchargement...")
    response = session.get(CHOIX_DONNEE_URL, headers=headers, verify=False)
    response.raise_for_status()
    download_form_data = extract_form_data(response.text)
    if not download_form_data:
        print("Erreur : Formulaire de téléchargement introuvable.")
        exit(1)
    download_form_action = get_form_action(response.text)
    if not download_form_action:
        print("Erreur : Action du formulaire de téléchargement introuvable.")
        exit(1)
    download_url = BASE_URL + download_form_action

    # 9. Préparer les données pour le téléchargement du CSV
    print("9. Préparation des données pour le téléchargement du CSV...")
    download_form_data.update({
        "javax.faces.ViewState": download_form_data.get("javax.faces.ViewState", ""),
        "form:j_idt180": "form:j_idt180",
    })

    # 10. Téléchargement du CSV
    print("10. Téléchargement du CSV...")
    response = session.post(download_url, data=download_form_data, headers=headers, stream=True, verify=False)
    if response.status_code == 200 and 'Content-Disposition' in response.headers:
        filename = "Mes_Notes_aux_epreuves.csv"
        content_disposition = response.headers.get('Content-Disposition')
        if content_disposition:
            fname = content_disposition.split('filename=')[1].strip('"')
            if fname:
                filename = fname
        file_path = os.path.join(DOWNLOAD_DIR, filename)
        with open(file_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=1024):
                if chunk:
                    f.write(chunk)
        print(f"Téléchargement réussi : {file_path}")
    else:
        print("Erreur : échec du téléchargement du CSV.")
        exit(1)

except requests.exceptions.RequestException as e:
    print(f"Erreur de requête HTTP : {e}")
except Exception as ex:
    print(f"Une erreur est survenue : {ex}", file=sys.stderr)