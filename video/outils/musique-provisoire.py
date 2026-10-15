# Musique provisoire de la publicité (60 s), en attendant la vraie (Lyria, banque sous licence…) : électronique douce
# à 105 battements par minute, calée sur les scènes du storyboard (montée, cassure à 0:31, impact du logo à 0:50).
# Fabriquée ici, sans rien télécharger : public/musique/provisoire.wav (python3 outils/musique-provisoire.py).
import os
import wave

import numpy as np

TAUX = 48000
DUREE = 60.0
BPM = 105
TEMPS = 60 / BPM            # un temps
MESURE = 4 * TEMPS
n = int(TAUX * DUREE)
t = np.arange(n) / TAUX
rng = np.random.default_rng(360)

def note(m):
    """Fréquence d'une note MIDI"""
    return 440 * 2 ** ((m - 69) / 12)

def enveloppe(x, attaque, chute):
    return np.minimum(1, x / attaque) * np.exp(-x / chute)

def passe_bas(x, coupure):
    """Filtre passe-bas à un pôle"""
    a = np.exp(-2 * np.pi * coupure / TAUX)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y

def scie(f, duree, harmoniques=8):
    x = np.arange(int(duree * TAUX)) / TAUX
    return sum(np.sin(2 * np.pi * f * k * x) / k for k in range(1, harmoniques + 1))

# Accords (la mineur) : Am9, Fmaj7, C, G — deux mesures chacun
ACCORDS = [[57, 60, 64, 71], [53, 57, 60, 64], [48, 55, 60, 64], [55, 59, 62, 67]]
BASSES = [45, 41, 48, 43]

musique = np.zeros(n)

def ajouter(son, debut, gain=1.0):
    i = int(debut * TAUX)
    if i >= n:
        return
    fin = min(n, i + len(son))
    musique[i:fin] += gain * son[: fin - i]

# Nappe : accords tenus, légèrement désaccordés, filtrés
mesure = 0
debut = 0.0
while debut < DUREE:
    accord = ACCORDS[(mesure // 2) % 4]
    duree = 2 * MESURE + 0.4
    x = np.arange(int(duree * TAUX)) / TAUX
    nappe = sum(scie(note(m), duree, 5) + 0.6 * scie(note(m) * 1.004, duree, 5) for m in accord)
    env = np.minimum(1, x / 0.8) * np.minimum(1, (duree - x) / 0.6)
    ajouter(nappe * env, debut, 0.018)
    mesure += 2
    debut += 2 * MESURE

musique = passe_bas(musique, 1800)

def section(t0, t1):
    return lambda s: t0 <= s < t1

batterie = section(5.0, 31.0)
reprise = section(33.2, 50.0)

# Grosse caisse (temps 1 et 3, puis tous les temps), charleston, basse pulsée, arpèges
k = 0
s = 0.0
while s < DUREE:
    if batterie(s) or reprise(s):
        temps = k % 4
        if temps in (0, 2) or s >= 11.0:
            x = np.arange(int(0.35 * TAUX)) / TAUX
            frequence = 45 + 75 * np.exp(-x * 30)
            caisse = np.sin(2 * np.pi * np.cumsum(frequence) / TAUX) * np.exp(-x * 9)
            ajouter(caisse, s, 0.55 if s >= 11.0 else 0.35)
        for demi in (0, 0.5):
            x = np.arange(int(0.04 * TAUX)) / TAUX
            bruit = np.diff(rng.standard_normal(len(x) + 1)) * np.exp(-x * 120)
            ajouter(bruit, s + demi * TEMPS, 0.05 if s >= 11.0 else 0.03)
        # basse : la fondamentale de l'accord, en croches
        b = BASSES[(int(s / (2 * MESURE))) % 4]
        for demi in (0, 0.5):
            x = np.arange(int(TEMPS / 2 * TAUX)) / TAUX
            ajouter(np.tanh(2 * np.sin(2 * np.pi * note(b) * x)) * enveloppe(x, 0.01, 0.12), s + demi * TEMPS, 0.10)
    # arpèges (doubles croches) pendant la recherche, l'immersion et la ville
    if 11.0 <= s < 31.0 or 41.0 <= s < 50.0:
        accord = ACCORDS[(int(s / (2 * MESURE))) % 4]
        for q in range(4):
            m = accord[(k * 4 + q) % 4] + 12
            x = np.arange(int(0.25 * TAUX)) / TAUX
            ajouter(np.sin(2 * np.pi * note(m) * x) * enveloppe(x, 0.003, 0.08), s + q * TEMPS / 4, 0.045)
    k += 1
    s += TEMPS

def montee(fin, duree, gain):
    x = np.arange(int(duree * TAUX)) / TAUX
    bruit = passe_bas(rng.standard_normal(len(x)), 3000) * (x / duree) ** 2
    ajouter(bruit, fin - duree, gain)

montee(31.0, 2.5, 0.25)   # avant la cassure « Vous avez un bien ? »
montee(50.4, 3.0, 0.30)   # avant le logo

# Impact du logo : basse profonde et souffle
x = np.arange(int(4.0 * TAUX)) / TAUX
impact = np.sin(2 * np.pi * (38 + 30 * np.exp(-x * 4)) * x) * np.exp(-x * 1.2)
ajouter(impact, 50.5, 0.7)
ajouter(passe_bas(rng.standard_normal(len(x)), 1200) * np.exp(-x * 2.5), 50.5, 0.25)

# Scintillement de l'arc doré au début, et note finale
for i, (debut, m) in enumerate([(0.3, 88), (0.42, 93), (0.55, 95)]):
    x = np.arange(int(1.5 * TAUX)) / TAUX
    ajouter(np.sin(2 * np.pi * note(m) * x) * enveloppe(x, 0.005, 0.5), debut, 0.05)

# Fondu de sortie et normalisation
fondu = np.minimum(1, (DUREE - t) / 4.0)
musique *= fondu
musique /= np.max(np.abs(musique)) * 1.12
stereo = np.stack([musique, musique], axis=1)

sortie = os.path.join(os.path.dirname(__file__), "../public/musique/provisoire.wav")
os.makedirs(os.path.dirname(sortie), exist_ok=True)
with wave.open(sortie, "wb") as f:
    f.setnchannels(2)
    f.setsampwidth(2)
    f.setframerate(TAUX)
    f.writeframes((stereo * 32767).astype("<i2").tobytes())
print("écrit :", os.path.normpath(sortie))
