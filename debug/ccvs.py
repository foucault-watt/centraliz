import requests
from bs4 import BeautifulSoup
import os

# Variables de configuration
BASE_URL = "https://webaurion.centralelille.fr"
LOGIN_URL = f"{BASE_URL}/faces/Login.xhtml"
MAIN_MENU_URL = f"{BASE_URL}/faces/MainMenuPage.xhtml"
CHOIX_DONNEE_URL = f"{BASE_URL}/faces/ChoixDonnee.xhtml"
CSV_DOWNLOAD_URL = f"{BASE_URL}/faces/ChoixDonnee.xhtml"
USERNAME = "fwattinn"          # Remplacez par votre nom d'utilisateur
PASSWORD = "ent-DOUDOU1"       # Remplacez par votre mot de passe
DOWNLOAD_DIR = "downloads"     # Répertoire où le CSV sera enregistré

# Créer le répertoire de téléchargement s'il n'existe pas
if not os.path.exists(DOWNLOAD_DIR):
    os.makedirs(DOWNLOAD_DIR)

# Initialiser une session pour gérer les cookies
session = requests.Session()

# En-têtes HTTP communs
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept-Language": "fr",
    "Connection": "keep-alive"
}

def extract_viewstate(html_content):
    """Extrait la valeur de ViewState depuis le contenu HTML."""
    soup = BeautifulSoup(html_content, "html.parser")
    viewstate = soup.find("input", {"name": "javax.faces.ViewState"})
    if viewstate:
        return viewstate.get("value")
    return None

def get_page(url):
    """Effectue une requête GET et retourne le contenu HTML."""
    response = session.get(url, headers=headers)
    response.raise_for_status()
    return response.text

def post_form(url, data):
    """Effectue une requête POST avec les données du formulaire."""
    response = session.post(url, data=data, headers=headers)
    response.raise_for_status()
    return response.text

try:
    # 1. Accéder à la page de connexion
    print("1. Accès à la page de connexion...")
    login_page = get_page(LOGIN_URL)
    
    # 2. Extraire le ViewState de la page de connexion
    viewstate_login = extract_viewstate(login_page)
    if not viewstate_login:
        print("Erreur : ViewState non trouvé dans la page de connexion.")
        exit(1)
    
    # 3. Préparer les données du formulaire de connexion
    login_data = {
        "username": "fwattinn",
        "password": "ent-DOUDOU1",
        "j_idt27": "",
        "form": "form",
        "form:largeurDivCenter": "12",
        "form:idInit": "webscolaapp.MainMenuPage_-2174809500206825303",
        "form:sauvegarde": "",
        "form:j_idt756_focus": "",
        "form:j_idt756_input": "44323",
        "javax.faces.ViewState": viewstate_login,
        "form:sidebar": "form:sidebar",
        "form:sidebar_menuid": "1_0_0"
    }
    
    # 4. Soumettre le formulaire de connexion
    print("2. Soumission des identifiants de connexion...")
    response_login = post_form(LOGIN_URL, login_data)
    
    # 5. Extraire le ViewState de la réponse après connexion
    viewstate_main = extract_viewstate(response_login)
    if not viewstate_main:
        print("Erreur : ViewState non trouvé après la connexion principale.")
        exit(1)
    
    # 6. Accéder à la page principale
    print("3. Accès à la page principale...")
    main_page = get_page(BASE_URL + "/")
    
    # 7. Accéder à la page de menu principal (si nécessaire)
    print("4. Accès au menu principal...")
    response_menu = post_form(MAIN_MENU_URL, {
        "form": "form",
        "form:largeurDivCenter": "12",
        "form:idInit": "webscolaapp.MainMenuPage_-2174809500206825303",
        "form:sauvegarde": "",
        "form:j_idt756_focus": "",
        "form:j_idt756_input": "44323",
        "javax.faces.ViewState": viewstate_main,
        "form:sidebar": "form:sidebar",
        "form:sidebar_menuid": "1_0_0"
    })
    
    # 8. Extraire le ViewState pour le téléchargement du CSV
    viewstate_choix = extract_viewstate(response_menu)
    if not viewstate_choix:
        print("Erreur : ViewState non trouvé pour le téléchargement.")
        exit(1)
    
    # 9. Accéder à la page de sélection des données
    print("5. Accès à la page de sélection des données...")
    choix_donnee_page = get_page(CHOIX_DONNEE_URL)
    
    # 10. Préparer les données pour le téléchargement du CSV
    download_data = {
        "form": "form",
        "form:largeurDivCenter": "443",
        "form:idInit": "webscolaapp.ChoixDonnee_-7644945337518171913",
        "form:messagesRubriqueInaccessible": "",
        "form:search-texte": "",
        "form:search-texte-avancer": "",
        "form:input-expression-exacte": "",
        "form:input-un-des-mots": "",
        "form:input-aucun-des-mots": "",
        "form:input-nombre-debut": "",
        "form:input-nombre-fin": "",
        "form:calendarDebut_input": "",
        "form:calendarFin_input": "",
        "form:j_idt193_reflowDD": "0_0",
        "form:j_idt193:j_idt272:filter": "",
        "form:j_idt193:j_idt274:filter": "",
        "form:j_idt193:j_idt276:filter": "",
        "form:j_idt193:j_idt278:filter": "",
        "form:j_idt193:j_idt280:filter": "",
        "form:j_idt193:j_idt282:filter": "",
        "form:j_idt193:j_idt284:filter": "",
        "form:j_idt193:j_idt286:filter": "",
        "form:j_idt193:j_idt288:filter": "",
        "form:j_idt259_focus": "",
        "form:j_idt259_input": "44323",
        "javax.faces.ViewState": viewstate_choix,
        "form:j_idt180": "form:j_idt180"
    }
    
    # 11. Télécharger le CSV
    print("6. Téléchargement du CSV des Notes...")
    response_csv = session.post(CSV_DOWNLOAD_URL, data=download_data, headers=headers, stream=True)
    
    if response_csv.status_code == 200:
        content_disposition = response_csv.headers.get("Content-Disposition", "")
        filename = "Mes_Notes_aux_epreuves.csv"
        if 'filename="' in content_disposition:
            filename = content_disposition.split('filename=')[1].strip('"')
        
        file_path = os.path.join(DOWNLOAD_DIR, filename)
        with open(file_path, "wb") as f:
            for chunk in response_csv.iter_content(chunk_size=1024):
                if chunk:
                    f.write(chunk)
        print(f"Téléchargement réussi : {file_path}")
    else:
        print(f"Erreur : Le téléchargement du CSV a échoué avec le statut {response_csv.status_code}.")
    
except requests.exceptions.RequestException as e:
    print(f"Erreur de requête HTTP : {e}")
except Exception as ex:
    print(f"Une erreur est survenue : {ex}")