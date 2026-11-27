# Flux Pokémon : envoyer seulement les tuiles 8×8 modifiées ?

Mesuré le 27/11/2026 sur le vrai serveur, en lecture seule (aucun bouton pressé). Un joueur était en train de jouer pendant les séries 2 à 4 : on a donc de la marche, un dialogue et un combat réels.

## Verdict : **plus tard**, et seulement si la bande passante devient un vrai problème

- Le gain est réel : **−76 % d'octets d'image** sur l'ensemble des mesures (−60 % à −92 % selon la scène), en plus du 304.
- Mais une fois le 304 en place, il reste peu à gagner en valeur absolue : environ **0,86 Mo/s pour 30 joueurs** (et non 2,6 Mo/s), qui passerait à environ 0,21 Mo/s.
- Le delta **ne réduit pas le nombre de requêtes** (toujours environ 890 req/s pour 30 joueurs). Si la charge vient des requêtes et non des octets, c'est le WebSocket qu'il faut, pas le delta.
- Si on le fait un jour, il ne faut **pas** faire des « tuiles » au sens strict. Il faut envoyer un **rectangle modifié** (le plus petit rectangle qui contient toutes les tuiles changées), en webp lossless, avec ses coordonnées. C'est plus simple et c'est aussi ce qui pèse le moins.
- **Le WebSocket n'est pas nécessaire** pour le delta. En interrogation HTTP, le client envoie déjà l'identifiant de son image (`If-None-Match`). Le serveur calcule le delta depuis cette image, ou renvoie l'image complète s'il ne la connaît plus. C'est même plus simple qu'en WebSocket, parce que le serveur n'a aucun état à garder par client.

## Mesures

4 séries capturées à 30 img/s via `POST /core/screenshot`. La latence médiane était de 10 à 13 ms et aucune image n'était illisible. Les octets comptés sont ceux du corps de la réponse, sans les en-têtes HTTP. Les images identiques à la précédente ne sont pas comptées (elles reçoivent un 304, sans corps).

| Série | Scène | Durée | Images identiques | Tuiles changées (moy. / p95 sur 600) |
|---|---|---|---|---|
| s1 | Labo du Prof. Chen, personne ne bouge | 22 s | 84 % | 6 / 10 |
| s2 | Labo, le joueur marche (défilement) | 25 s | 82 % | 67 / 523 |
| s3 | Labo, marche puis dialogue avec Chen | 25 s | 49 % | 171 / 515 |
| s4 | Premier combat contre le rival | 30 s | 44 % | 32 / 168 |

Les captures de chaque scène sont dans `scenes/` et les résultats bruts dans `result-*.json`.

### Octets par image modifiée : image complète vs delta (rectangle modifié)

| Série | Image complète webp (moy. / p95) | Rectangle modifié webp (moy. / p95) | Tuiles rangées en grille webp (moy. / p95) | Gain moyen (rectangle) |
|---|---|---|---|---|
| s1 immobile | 3 022 / 3 144 o | 245 / 400 o | 246 / 348 o | **−92 %** |
| s2 marche | 3 001 / 3 084 o | 553 / 2 956 o | 607 / 3 397 o | **−82 %** |
| s3 marche + dialogue | 2 669 / 3 074 o | 1 073 / 2 906 o | 1 219 / 3 335 o | **−60 %** |
| s4 combat | 2 330 / 2 746 o | 371 / 1 026 o | 376 / 996 o | **−84 %** |

### Débit pour un joueur (corps d'image seulement, 304 déjà en place)

| Série | Image complète | Delta « rectangle ou image complète » | Gain |
|---|---|---|---|
| s1 | 14,1 Ko/s | 1,1 Ko/s | −92 % |
| s2 | 16,4 Ko/s | 3,0 Ko/s | −82 % |
| s3 | 41,4 Ko/s | 16,7 Ko/s | −60 % |
| s4 | 39,1 Ko/s | 6,2 Ko/s | −84 % |
| **Total (102 s)** | **28,7 Ko/s** | **6,9 Ko/s** | **−76 %** |
| 30 joueurs | 0,86 Mo/s (≈ 6,9 Mbit/s) | 0,21 Mo/s | |

Sur ces 102 s, 63 % des images étaient identiques, soit 11 images modifiées par seconde en moyenne.

### Autres encodages testés pour les tuiles

Mesuré sur le total. Tous ces encodages pèsent plus que le rectangle webp.

| Encodage des tuiles changées | Débit pour 1 joueur | Gain vs image complète |
|---|---|---|
| Rectangle modifié, webp lossless | 6,9 Ko/s | −76 % |
| Tuiles en grille, webp lossless | 7,6 Ko/s | −74 % |
| Tuiles, pixels 15 bits (format GBA) + deflate | 8,9 Ko/s | −69 % |
| Tuiles, RGB brut + deflate | 9,7 Ko/s | −66 % |
| Tuiles en grille, PNG | 10,5 Ko/s | −63 % |

L'en-tête des tuiles (index ou bitmap de 75 o) est compté. Pour le rectangle, l'en-tête compte 8 o.

### Marche (défilement de tout l'écran)

En jeu, les images de marche changent **401 à 600 tuiles sur 600** (s2 et s3). Pour vérifier, j'ai simulé un défilement en décalant 8 images réelles de 1, 2, 4, 8 et 16 px, horizontalement et verticalement :

| Décalage | Tuiles changées | Image complète | Rectangle | Tuiles en grille webp | Tuiles 15 bits deflate |
|---|---|---|---|---|---|
| 1 px | 440 | 2 776 o | 2 765 o | 3 122 o | 3 929 o |
| 2 px | 441 | 2 781 o | 2 769 o | 3 122 o | 3 938 o |
| 8 px | 386 | 2 784 o | 2 772 o | 2 967 o | 3 764 o |
| 16 px | 340 | 2 785 o | 2 779 o | 2 874 o | 3 649 o |

Quand l'écran défile, **le delta ne gagne rien**. Le rectangle couvre tout l'écran, et les tuiles rangées en grille pèsent 3 à 12 % de plus que l'image complète. C'est pour ça que s3 ne gagne que 60 %. Le serveur doit donc envoyer « le plus petit des deux », ce qui est déjà compté dans les débits ci-dessus. Une méthode qui gagnerait aussi pendant la marche (envoyer un vecteur de défilement et réutiliser les tuiles déjà connues) serait nettement plus complexe : je ne la recommande pas.

### Coût CPU sur le serveur (par image modifiée)

- Image complète webp, comme aujourd'hui : 7 ms en moyenne, 10 ms au p95.
- Comparaison des 600 tuiles : environ 1 ms.
- Encodage webp du rectangle ou des tuiles : 1 ms en moyenne, 3 ms au p95.

Le delta coûte donc moins de CPU par image que l'image complète, mais il s'y ajoute : l'image complète reste nécessaire pour les nouveaux clients et les clients en retard.

### Ce que les chiffres ne disent pas (en-têtes HTTP)

En sortie de Node, une réponse fait environ 990 o d'en-têtes (CORS et en-têtes de sécurité de helmet), mesuré sur un 401. Les navigateurs passent par nginx en **HTTP/2**, qui compresse les en-têtes répétés (HPACK). Je l'estime à environ 100 à 150 o par échange, **sans l'avoir mesuré**. À 30 requêtes par seconde, cela fait environ 3 à 4,5 Ko/s par joueur, que l'image ait changé ou non (304 compris). Avec le delta, ces en-têtes deviendraient **à peu près aussi lourds que les images elles-mêmes** (6,9 Ko/s). Seul le WebSocket supprimerait ce coût.

## Complexité d'une implémentation propre (variante « rectangle modifié », en HTTP)

**Serveur (`pokemonFrameService` + route), environ 80 à 100 lignes :**
- garder les pixels bruts des N dernières images (par exemple 30 × 115 Ko = 3,5 Mo), indexés par `frameId` ;
- quand une requête arrive avec `If-None-Match: <id>` :
  - si `id` est l'image actuelle → 304 (déjà fait) ;
  - si `id` fait partie des N dernières images → calculer le rectangle modifié entre cette image et l'actuelle (environ 2 ms), le garder en cache par couple (id de départ, id actuel), puis renvoyer `200` avec le webp du rectangle et les en-têtes `X-Frame-Base: <id>` et `X-Frame-Rect: x,y,l,h` ;
  - si le rectangle pèse plus que l'image complète, ou si `id` est inconnu → image complète (comme aujourd'hui).
- **Pas d'image clé périodique ni de resynchronisation à gérer** : chaque réponse est soit autonome (image complète), soit calculée depuis l'image exacte que le client affiche. Un client en retard reçoit un rectangle plus grand ou l'image complète.

**Navigateur (`usePokemonStream` + composant), environ 40 à 60 lignes :**
- passer de `<img src=blob:>` à un `<canvas>` de 240×160 ;
- image complète : `createImageBitmap(blob)`, puis `drawImage` ;
- rectangle : `drawImage(bitmap, x, y)`, **seulement si** `X-Frame-Base` est l'image affichée. Sinon, on oublie l'ETag et on redemande une image complète ;
- la boucle d'interrogation est déjà séquentielle, donc il n'y a pas de problème de réponses dans le désordre.

**Tests : environ 80 à 120 lignes** (delta depuis l'image précédente, depuis une image plus ancienne, base inconnue, image complète plus légère que le rectangle, client qui applique un rectangle sur la mauvaise base).

**Total : environ 200 à 280 lignes, tests compris.** La variante « tuiles » au sens strict ajouterait environ 40 lignes (format binaire, index, un `drawImage` par tuile) pour un résultat moins bon.

**Risques :**
1. **Image corrompue qui reste affichée** : si un rectangle est appliqué sur la mauvaise base, l'erreur reste à l'écran jusqu'à la prochaine image complète, ce qui peut arriver rarement en scène immobile. Mesure de protection : vérification stricte de `X-Frame-Base`, et une image complète forcée toutes les quelques secondes côté client. Le test n'est pas simple, car l'erreur est visuelle.
2. **Cache par client** : la réponse dépend de `If-None-Match`. Il faut `Cache-Control: no-store`, sinon nginx risque de mélanger les réponses.
3. **Mémoire et CPU** : 3,5 Mo de mémoire tampon, environ 2 ms par image de base distincte. C'est négligeable.
4. **Passage au canvas** : le comportement change pour l'agrandissement, la netteté et la capture d'écran par l'utilisateur. Il faut garder `image-rendering: pixelated`.

## Comparaison des options

| Option | Octets (30 joueurs, en jeu) | Requêtes/s | Complexité |
|---|---|---|---|
| Image complète seule | ≈ 2,6 Mo/s | ≈ 890 | existe |
| + 304 si identique (en cours) | **≈ 0,86 Mo/s** mesuré | ≈ 890 | ~20 lignes, presque fini |
| + delta en rectangle (HTTP) | ≈ 0,21 Mo/s + en-têtes | ≈ 890 | ~250 lignes, risque d'image corrompue |
| WebSocket qui pousse l'image complète si elle change | ≈ 0,86 Mo/s, sans en-têtes | 0 (11 messages/s par joueur) | connexion, reconnexion, auth de session, nginx `Upgrade` |
| WebSocket + delta | ≈ 0,21 Mo/s | 0 | les deux, avec un état par client |

## Recommandation

1. Terminer le 304 et regarder la charge réelle du serveur avec des joueurs.
2. Si la limite vient des **requêtes ou du CPU de nginx et Node**, passer au WebSocket (push seulement quand l'image change). Le delta n'aide pas dans ce cas.
3. Si la limite vient de la **bande passante sortante**, ajouter le delta en rectangle, en HTTP, avec un repli vers l'image complète. C'est un gain d'environ 4× pour environ 250 lignes.
4. Ne pas faire les tuiles au sens strict ni la compensation de défilement : c'est plus complexe et ça pèse plus lourd.

## Reproduire

```bash
# sur le serveur (node via /home/fwattinne/.volta/bin/node)
node capture.cjs /tmp/ptiles/s1 25 30     # 25 s à 30 img/s, aucun bouton
node analyze.cjs /tmp/ptiles/s1           # tableau JSON des mesures
node analyze.cjs /tmp/ptiles/s1 --scroll  # simulation de défilement
```

Les scripts sont envoyés avec `node tools/pokemon-remote.cjs put` (avec `MSYS_NO_PATHCONV=1` sous Git Bash).
