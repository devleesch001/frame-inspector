# Frame Inspector

**Frame Inspector** est un outil web puissant et intuitif conçu pour les développeurs, ingénieurs. Il permet d'inspecter, d'analyser et de décoder instantanément des trames de données binaires brutes en une multitude de formats interprétables.

Que vous travailliez sur des protocoles réseau, du débogage de fichiers binaires ou de l'analyse de paquets IoT, Frame Inspector vous offre une vue unifiée de vos données sous toutes leurs formes possibles (Entiers, Flottants, Endianness varié et certain type exotique, ASCII, etc.).

**[Accéder à l'outil en ligne](https://devleesch001.github.io/frame-inspector/)**

---

## Fonctionnalités Principales

-   **Multi-Format Input** : Détection automatique et prise en charge des entrées :
    -   **Hexadécimal** (brut ou formaté avec `0x`, espaces acceptés).
    -   **Base64**.
    -   **Tableaux** (Array d'entiers décimaux, ex: `[10, 255]`).
-   **Décodage Complet** : Visualisez vos données interprétées comme :
    -   `Int8`, `Uint8`
    -   `Int16`, `Uint16`
    -   `Int32`, `Uint32`
    -   `Int64`, `Uint64` (Support complet 64-bit)
    -   `Float32`, `Float64`
-   **Gestion de l'Endianness** : Support exhaustif pour toutes les architectures :
    -   Big Endian
    -   Little Endian
    -   Mid-Big / Mid-Little (pour les formats exotiques)
-   **Aperçus Rapides** : Conversion instantanée vers ASCII, Hex, Base64 et Array JS.
-   **Interface Moderne** : UI sombre, responsive, avec "Segmented Controls" et affichage en grille adaptatif.

---

## 🛠 Comment l'utiliser

1.  **Collez vos données** dans la zone de texte principale ("Input Data").
2.  L'outil détecte automatiquement le format ("Auto"). En cas d'ambiguïté (par exemple `10` qui peut être `0x10` ou `[10]`), un badge **"Ambiguous!"** apparaît. Vous pouvez alors forcer le mode via les boutons (Hex, Base64, Array).
3.  **Explorez les résultats** : Faites défiler pour voir comment vos octets sont interprétés dans différents types (Int, Float...) et ordres (Endianness).
4.  Utilisez les **flèches** pour replier les sections qui ne vous intéressent pas.

---

## Exemples d'Entrées Valides

Voici des exemples de chaînes que vous pouvez tester :

### Hexadécimal (Hex)
Accepte les formats bruts, avec espaces, ou préfixés.
```text
48 65 6c 6c 6f 21
0x48 0x65 0x6c 0x6c 0x6f
48656c6c6f21
```

### Base64
Idéal pour décoder des payload web ou email.
```text
SGVsbG8gV29ybGQ=
```

### Tableau / Array
Liste d'octets décimaux (0-255). Supporte les parenthèses `()`, crochets `[]` et accolades `{}`.
```text
[72, 101, 108, 108, 111]
(10, 20, 30)
10, 255, 0
```

---

## Signaler un Bug

Si vous rencontrez un comportement inattendu, une erreur de décodage ou si vous avez une suggestion d'amélioration :

1.  Rendez-vous sur l'onglet **[Issues](https://github.com/devleesch001/frame-inspector/issues)** du dépôt GitHub.
2.  Créez une **New Issue**.
3.  Décrivez le problème et fournissez si possible la chaîne de caractères (Input) qui a causé l'erreur.

---

## Crédits & Intelligence Artificielle

Ce projet est particulier : **il a été entièrement réalisé par une Intelligence Artificielle**.

-   **Conception, Design, Code (HTML/CSS/JS) et Documentation** : Générés par l'IA (Agent Antigravity de Google DeepMind).
-   **Objectif** : Tester la capacité de l'IA à créer des outils fonctionnels et esthétiques.

---

