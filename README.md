# Tuleva minä

**Priorisoi tulevan itsesi tarpeet.** 66 päivän tutkimukseen perustuva tapaohjelma, jossa opit tekemään päivän pienet valinnat sen ihmisen hyväksi, joka olet huomenna, vuoden ja kymmenen vuoden päästä.

Sovellus on täysin selaimessa toimiva PWA (progressive web app): ei tiliä, ei palvelinta, ei seurantaa. Tiedot tallentuvat vain omaan laitteeseen.

## Miksi 66 päivää?

Lallyn ja kollegoiden tutkimuksessa (2010) uusi teko muuttui automaattiseksi keskimäärin **66 päivässä**, kun sitä toistettiin päivittäin samassa tilanteessa. Vaihteluväli oli suuri (18–254 päivää), ja yksi väliin jäänyt päivä ei haitannut. Ohjelman vähimmäiskesto on siksi 66 päivää, ja sen jälkeen voi jatkaa "vapaana jatkona" tai aloittaa uuden ohjelman uudella ankkuriteolla.

## Mitä sovellus tekee

Joka päivä:

- **Yksi tutkimukseen perustuva vinkki** (66 erilaista, kuudessa vaiheessa) lähdeviitteineen.
- **2–3 pientä tekoa** tulevan itsen hyväksi, yhteensä alle 10 minuuttia:
  - *Ankkuriteko*: oma alle 2 minuutin teko jos–niin-muodossa ("Kun olen laittanut kahvin tippumaan, niin kirjoitan yhden lauseen tulevalle itselleni"). Sama teko samassa tilanteessa joka päivä rakentaa automaattisuuden.
  - *Päivän teko*: vinkkiin liittyvä mikroteko.
  - *Painopistealueen teko*: valituilta alueilta vuorotellen (terveys, raha, oppiminen, ihmissuhteet, työ ja opinnot, mieli ja uni).
- **Automaattisuuden itsearvio** (1–5), josta piirtyy oma "Lallyn käyrä".
- **Muistiinpano** "Mitä tuleva minä kiittää tänään?" – rivin voi lisätä myös sinetöityyn kirjeeseen.

Lisäksi:

- **Kirje tulevalle itselle** kirjoitetaan päivänä 1, sinetöidään ja avataan päivänä 66.
- **Viikkokatsaus** joka seitsemäs päivä (kolme kysymystä).
- **Lempeä paluuviesti**, jos päivä jäi väliin – ilman syyllistämistä.
- **Edistyminen**: putki, aktiiviset päivät, tekojen määrä, 66 päivän kalenteri, ohjelman vaiheet.
- **Tutkimus**-näkymä: 31 lähdettä ja miten niitä on käytetty.
- Muistutus valittuun kellonaikaan (kun sovellus on auki tai asennettuna ja ilmoitukset sallittu), tumma tila, JSON-vienti ja -tuonti, offline-käyttö.

## Ohjelman vaiheet

| Päivät | Vaihe | Keskeinen tutkimus |
|---|---|---|
| 1–10 | Tutustu tulevaan itseesi | Ersner-Hershfield ym. 2009; Hershfield ym. 2011; Rutchick ym. 2018; Blouin-Hudon & Pychyl 2015 |
| 11–22 | Jos–niin ja pienet teot | Gollwitzer & Sheeran 2006; Wood ym. 2002; Lally ym. 2010; Phillips & Gardner 2016 |
| 23–35 | Sitoumukset ja houkutukset | Rogers ym. 2014; Milkman ym. 2014; Thaler & Benartzi 2004; Oettingen/WOOP (Wang ym. 2021) |
| 36–48 | Identiteetti ja arvot | Bryan ym. 2011; Sheldon & Lyubomirsky 2006; Waldinger & Schulz 2023 |
| 49–60 | Kestävyys ja palautuminen | Breines & Chen 2012; Marlatt & Donovan 2005; Wood & Rünger 2016 |
| 61–66 | Vakiinnuta ja katso eteenpäin | Lally ym. 2010; Gardner ym. 2012 |

Tarkempi tutkimuskatsaus: [docs/tutkimus.md](docs/tutkimus.md).

## Käyttö

Sovellus on staattinen sivusto. Avaa `index.html` paikallisella palvelimella tai julkaise GitHub Pagesissa:

```bash
# paikallisesti
python3 -m http.server 8000
# → http://localhost:8000
```

GitHub Pages: repossa on valmis työnkulku `.github/workflows/pages.yml`. Ota käyttöön kohdasta *Settings → Pages → Source: GitHub Actions*. Puhelimessa sovelluksen voi asentaa aloitusnäytölle ("Lisää Koti-valikkoon" / "Asenna sovellus").

## Rakenne

```
index.html            sovelluksen runko
css/style.css         tyylit (vaalea ja tumma tila)
js/content.js         66 päivän vinkit ja teot, aluepoolit, lähteet
js/app.js             logiikka: perehdytys, päivänäkymä, edistyminen, kirje, asetukset
sw.js                 service worker (offline)
manifest.webmanifest  PWA-manifesti
icons/                ikonit
docs/tutkimus.md      tutkimuskatsaus
```

Ei riippuvuuksia, ei build-vaihetta. Testaus: selaintesti Playwrightilla käy läpi perehdytyksen, päivän teot, edistymisen, päivän 66 kirjeen avauksen ja jatkovaiheen.

## Huomio

Sovellus ei ole terveydenhuollon tai talousneuvonnan palvelu eikä korvaa ammattiapua. Tutkimustulokset ovat keskiarvoja; yksilölliset erot ovat suuria.
