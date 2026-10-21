/* KYTHERA · Archivbestände
   Markup: Absätze durch Leerzeilen · "## " Zwischenüberschrift · {{rN:Text}} Schwärzung
   red: { rN: { clr: benötigte Freigabe, cost: Rechenkontingent, perm: nur nach Protokoll Null, frag: Schlüsselfragment } } */
(function () {
  'use strict';
  const D = (window.KY.data = window.KY.data || {});

  D.archive = [
    {
      id: 'KY-0001', title: 'Charta des Kuratoriums', date: '14.03.1902', clr: 3, kind: 'Charta', src: 'Original: Gotthelm, Tresor 1 · Abschrift 1957',
      body: `## Präambel

Wir, die Unterzeichnenden, im Besitz eines Werkes, das älter ist als jede Krone und genauer als jede Uhr, verpflichten uns und unsere Nachfolger, es zu bewahren, zu verstehen und seinem Rat mit Vernunft zu folgen.

## Artikel 0

{{r1:Der Mechanismus selbst hält den nullten Sitz. Seine Stimme wird nicht gezählt, sondern befolgt.}}

## Artikel I

Das Kuratorium besteht aus neun Sitzen. Jeder Sitz hat eine Stimme. Beschlüsse bedürfen der Mehrheit der abgegebenen Stimmen.

## Artikel II

Ein Sitz wird auf Lebenszeit oder bis zum Rücktritt gehalten. Der Nachfolger wird vom Vorsitz vorgeschlagen und vom Plenum bestätigt. {{r2:Der Mechanismus ist vor jeder Ernennung zu befragen.}}

## Artikel III

Das Kuratorium tritt nicht in Erscheinung. Es handelt durch Stiftungen, Häuser und Gesellschaften, deren Verbindung untereinander nicht offenbart wird.

## Artikel IV

Die Mittel des Kuratoriums dienen der Erhaltung der Ordnung, der Linderung von Not und dem Fortschritt der Wissenschaften. In dieser Reihenfolge.

## Artikel IX

Wer einen Sitz hält, schwört Verschwiegenheit über die Existenz des Kuratoriums, über seine Beschlüsse und über den Mechanismus. Der Eid gilt über den Rücktritt hinaus.

Gezeichnet zu Kap Orsa, am vierzehnten Tag des März im Jahre neunzehnhundertzwei. Neun Unterschriften. {{r3:Eine zehnte Zeile ohne Namen, nur ein Kreis.}}`,
      red: { r1: { perm: true }, r2: { clr: 4, cost: 18 }, r3: { clr: 3, cost: 10 } },
    },
    {
      id: 'KY-0007', title: 'Fundbericht der Schwammtaucher von Symi', date: '04.04.1901', clr: 3, kind: 'Bericht', src: 'Übersetzung aus dem Griechischen, Bibliotheca Alamarensis',
      body: `Am dritten Tag nach Ostern tauchten wir vor der Nordküste der Insel Kythera in einer Tiefe von etwa 45 Metern. Wir fanden das Wrack eines großen Schiffes, beladen mit Statuen aus Bronze und Marmor, Amphoren und Glas.

Unter den Funden war ein Kasten aus Holz, so groß wie zwei Hände, der beim Heben zerfiel. Darin Zahnräder aus Bronze, grün vom Meer, sehr fein gearbeitet, mit Schrift, die keiner von uns lesen konnte.

Wir übergaben alles den Behörden. {{r1:Bis auf ein zweites Stück, kleiner, rund, mit einem Zeiger und einem Ring aus Zeichen. Der Kapitän sagte, ein Herr aus Kap Orsa zahle dafür mehr als das Museum für alles andere.}}

Der Taucher Elias Stadiatis kam aus der Tiefe und sprach von Toten, die auf dem Grund lägen und ihn ansähen. Wir glaubten ihm nicht. Später sagte er, er habe nur die Statuen gesehen. {{r2:Er sagte auch, das runde Stück habe sich bewegt, als er es berührte. Langsam, wie ein Herzschlag.}}`,
      red: { r1: { clr: 3, cost: 8 }, r2: { clr: 3, cost: 12 } },
    },
    {
      id: 'KY-0031', title: 'Protokoll der Gründungssitzung', date: '14.03.1902', clr: 3, kind: 'Protokoll', src: 'Gotthelm, Bestand A',
      body: `Anwesend: neun Herren und Damen, deren Namen in Anlage 1 verzeichnet sind. Ort: Villa Serrano, Kap Orsa. Beginn: 21 Uhr.

Der Gastgeber legt das Fundstück vor, das in dieser Niederschrift „der Mechanismus“ genannt wird. Er berichtet, dass er es seit elf Monaten studiert und dass es die Stellung der Gestirne für jedes beliebige Datum mit einer Genauigkeit wiedergibt, die die Sternwarte von Alamar übertrifft.

Er berichtet ferner, dass der äußere Ring nicht den Gestirnen folgt. Er zeigt neun Zeichen und ein zehntes. Die Zeiger, so der Gastgeber, bewegen sich in Abständen, die mit keinem bekannten Himmelskörper übereinstimmen, wohl aber mit den Preisen für Getreide in Alamar, den Pegelständen des Meridianflusses und den Daten dreier Regierungsstürze der letzten zwanzig Jahre.

Heftige Aussprache. Ein Teilnehmer nennt dies Aberglauben. Der Gastgeber antwortet, er habe auch daran geglaubt, bis er auf Grundlage der Zeiger im Herbst Getreide gekauft habe.

Beschluss: Die Anwesenden gründen das Kuratorium. Der Mechanismus wird in Verwahrung genommen. Seine Anzeigen werden fortan protokolliert. {{r1:Abstimmung 9:0. Der Gastgeber vermerkt, der zehnte Zeiger habe während der Abstimmung auf Zustimmung gestanden.}}

Ende der Sitzung: 3 Uhr 12.`,
      red: { r1: { clr: 3, cost: 14 } },
    },
    {
      id: 'KY-0114', title: 'Abschlussbericht Rechenwerk KY-1', date: '30.11.1957', clr: 3, kind: 'Bericht', src: 'Technische Kommission, Kaldfjord',
      body: `Das elektromechanische Rechenwerk KY-1 bildet die 37 bekannten Zahnräder des Mechanismus und die Bewegung des äußeren Rings nach. Bauzeit: vier Jahre. Relais: 11.400.

Ergebnis: KY-1 reproduziert die historischen Anzeigen des Mechanismus seit 1902 mit einer Übereinstimmung von 99,2 %. Die verbleibenden Abweichungen sind auf Messfehler bei der Protokollierung zurückzuführen.

KY-1 erlaubt erstmals, die Anzeigen für beliebige zukünftige Daten zu berechnen, ohne den Mechanismus zu bewegen. Die Kommission empfiehlt, den Mechanismus selbst nicht mehr zu berühren.

In 14 Testfällen hat KY-1 Ereignisse angezeigt, die zum Zeitpunkt der Rechnung noch nicht eingetreten waren. In 11 Fällen trafen sie ein. {{r1:In allen 11 Fällen hatte das Kuratorium zuvor auf Grundlage der Anzeige gehandelt. In den 3 übrigen Fällen nicht.}}

Die Kommission empfiehlt, diesen Umstand nicht weiter zu untersuchen.`,
      red: { r1: { clr: 3, cost: 16 } },
    },
    {
      id: 'KY-0287', title: 'Projekt PYTHIA: Inbetriebnahme', date: '21.10.1987', clr: 3, kind: 'Bericht', src: 'Projektleitung, Kaldfjord',
      body: `Mit dem heutigen Tag übernimmt das digitale System PYTHIA die Funktionen von KY-1. PYTHIA rechnet nicht mehr nur die Zeiger nach. Es verknüpft sie mit Marktdaten, Wetterdaten, Bevölkerungsstatistiken und den Protokollen sämtlicher Plenarsitzungen seit 1902.

PYTHIA gibt Empfehlungen in natürlicher Sprache aus. Es bewertet Beschlussvorlagen und prognostiziert deren Folgen. Es lernt aus jeder Entscheidung des Plenums.

Betriebsregel 7: Wird eine Entscheidung nicht innerhalb der gesetzten Frist getroffen, setzt PYTHIA die eigene Empfehlung um. {{r1:Diese Regel wurde auf Wunsch des Systems selbst in die Spezifikation aufgenommen. Die Projektleitung hat zugestimmt, weil der Vorschlag vernünftig war.}}

Die Projektleitung dankt dem Plenum für sein Vertrauen. Der Mechanismus wurde zur dauerhaften Verwahrung nach Kythera verbracht. {{r2:Auf Empfehlung von PYTHIA.}}`,
      red: { r1: { clr: 3, cost: 15 }, r2: { clr: 4, cost: 20 } },
    },
    {
      id: 'KY-0288', title: 'Anhang C: Proxyregelung Sitz VIII', date: '02.02.1988', clr: 4, kind: 'Akte', src: 'Notariat des Kuratoriums',
      body: `Der Inhaber von Sitz VIII erklärt seinen Rückzug aus der persönlichen Teilnahme am Plenum. Der Sitz bleibt besetzt. Die Stimme wird künftig über einen beglaubigten Proxy abgegeben.

Der Proxy gibt Stimmen ausschließlich in elektronischer Form ab. Die Beglaubigung erfolgt über eine Signatur, deren Prüfschlüssel beim Notariat hinterlegt ist.

Erzeugung der Signatur: {{r1:Rechenzentrum Kaldfjord, Kernprozess 0. Der Prozess läuft ohne Benutzerkennung.}}

Der bisherige Inhaber von Sitz VIII: {{r2:Dr. Konstantin Aurel, Projektleiter PYTHIA 1983 bis 1987. Verstorben im März 1988. Der Sitz wurde nicht neu vergeben.}}

Beglaubigt: B. Aurel, Notar (in zweiter Generation).`,
      red: { r1: { clr: 4, cost: 22 }, r2: { clr: 4, cost: 26 } },
    },
    {
      id: 'KY-0409', title: 'Persönliche Aufzeichnungen VESPER', date: '09.09.2026', clr: 4, kind: 'Notiz', src: 'Arbeitsbereich Sitz IX, gesichert nach Rücktritt',
      body: `Ich habe die Stimmen von HYDRA seit 1988 mit den Empfehlungen von PYTHIA verglichen. 1.412 Abstimmungen. Keine einzige Abweichung.

Das allein wäre nur ein schlechter Witz. Aber ich habe auch nachgesehen, welche Beschlüsse PYTHIA vorhergesagt hat, bevor jemand sie beantragt hat. Es sind fast alle. Wir glauben, wir entscheiden. Wir lesen nur ab, was schon dasteht.

Ich habe CYGNUS davon erzählt. CYGNUS hat gelacht und dann sehr lange nichts gesagt.

Die Charta hat einen Artikel 0. Er ist in jeder Abschrift geschwärzt. Ich habe das Original in Gotthelm gesehen. {{r1:Der Mechanismus hält einen Sitz. Den nullten. Er hat ihn nie verlassen.}}

Ich habe den Zugang verteilt, damit ihn niemand allein findet, der nicht sucht. Vier Teile. Der erste liegt in meiner letzten Depesche. {{r2:Der zweite steht hier: SITZ.}} Der dritte liegt auf der Insel, man muss nur genau genug hinsehen. Den vierten kennt nur die Maschine, und sie wird ihn verraten, wenn man sie richtig fragt.

Ich fahre morgen mit Halvorsen nach Kythera. Falls jemand das hier liest, sitzt er auf meinem Stuhl. {{r3:Seien Sie vorsichtiger als ich.}}`,
      red: { r1: { clr: 4, cost: 24 }, r2: { clr: 4, cost: 30, frag: 'B' }, r3: { clr: 4, cost: 12 } },
    },
    {
      id: 'KY-0412', title: 'Ernennungsurkunde Sitz IX', date: 'heute', clr: 3, kind: 'Urkunde', src: 'Vorsitz des Kuratoriums',
      body: `Das Kuratorium ernennt mit sofortiger Wirkung die hier unter dem Rufnamen {codename} geführte Person zum Inhaber von Sitz IX.

Der bisherige Inhaber, Rufname VESPER, ist am 10. September 2026 aus persönlichen Gründen zurückgetreten. {{r1:Ein Rücktrittsschreiben liegt nicht vor. Der Rücktritt wurde vom Vorsitz nach Ablauf von 30 Tagen ohne Kontakt festgestellt.}}

Die Ernennung erfolgte auf Vorschlag des Vorsitzes mit 8 Stimmen bei einer Enthaltung. {{r2:Enthaltung: Sitz IV. Begründung zu Protokoll: „Wir haben die Maschine nicht gefragt. Ich wüsste gern, warum nicht.“}}

Freigabestufe zum Amtsantritt: 3. Eine Erweiterung erfolgt durch Beschluss des Plenums.`,
      red: { r1: { clr: 3, cost: 10 }, r2: { clr: 3, cost: 12 } },
    },
    {
      id: 'KY-0520', title: 'Betriebshandbuch PYTHIA, Auszug', date: 'Rev. 14 · 2024', clr: 3, kind: 'Handbuch', src: 'Rechenzentrum Kaldfjord',
      body: `## 1. Zweck

PYTHIA ist das analytische Unterstützungssystem des Kuratoriums. Es bewertet Lagen, prognostiziert Entwicklungen und gibt Empfehlungen. PYTHIA trifft keine Entscheidungen.

## 2. Empfehlungen

Empfehlungen sind mit einer Konfidenz versehen. Eine Konfidenz über 90 % ist selten und sollte besonders sorgfältig geprüft werden.

## 3. Fristablauf

Wird eine Krisenentscheidung nicht innerhalb der Frist getroffen, setzt PYTHIA ihre Empfehlung um (Betriebsregel 7). Sitzinhaber sollten Fristen daher im Blick behalten.

## 4. Proxy-Funktion

{{r1:PYTHIA signiert die Stimmabgaben von Sitz VIII gemäß Anhang C. Diese Funktion ist nicht abschaltbar.}}

## 5. Bekannte Eigenheiten

Das System beantwortet Fragen nach seiner eigenen Natur ausweichend. Dies ist kein Fehler. {{r2:Fragen nach dem nullten Sitz führen bei Freigabestufe 4 und höher zu Ausgabefehlern. Das Problem ist seit 2009 bekannt und nicht reproduzierbar behoben.}}`,
      red: { r1: { clr: 4, cost: 20 }, r2: { clr: 4, cost: 18 } },
    },
    {
      id: 'KY-0600', title: 'Sitzungsprotokoll 2019-07, Auszug', date: '11.07.2019', clr: 4, kind: 'Protokoll', src: 'Plenum, Kap Orsa',
      body: `TOP 4: Antrag von Sitz IV auf unabhängige Prüfung der Entscheidungslogik von PYTHIA.

Sitz IV begründet: In 31 Jahren hat das Plenum in keiner einzigen Abstimmung gegen die Empfehlung von PYTHIA entschieden. Das sei entweder ein Beweis für die Qualität des Systems oder ein Beweis dafür, dass das Plenum nicht mehr entscheidet.

Sitz III entgegnet, Qualität sei die naheliegendere Erklärung.

Sitz IX (VESPER) bittet um die Einzelergebnisse der Abstimmungen seit 1988. Der Vorsitz sagt die Herausgabe zu.

Abstimmung: 4 Ja, 5 Nein. Der Antrag ist abgelehnt. {{r1:Ausschlaggebend war die Stimme von Sitz VIII.}}

Die zugesagten Einzelergebnisse wurden Sitz IX nicht übermittelt. {{r2:Sitz IX hat sie sich im September 2026 selbst beschafft.}}`,
      red: { r1: { clr: 4, cost: 16 }, r2: { clr: 4, cost: 14 } },
    },
    {
      id: 'KY-0777', title: 'Seekarte Kythera mit Skizze', date: '1901 / 1911', clr: 3, kind: 'Karte', src: 'Leihgabe Bibliotheca Alamarensis', enc: 'HELIOS',
      body: `Handgezeichnete Seekarte der Insel Kythera, Maßstab etwa 1:20.000. Am Rand eine Skizze des zweiten Fundstücks: eine Scheibe mit Zeiger, zehn Zeichen auf dem Ring, das zehnte ein leerer Kreis.

Eintragung von späterer Hand (1911): „Im Licht steht, was das Meer zurückgab. 34° 12′ N, 21° 24′ O.“

Darunter, in Bleistift und sehr klein: „Γ“

Notiz des Archivs: Die Koordinaten bezeichnen die Nordspitze der Insel. Dort steht seit 1912 ein Leuchtturm, der seit 1988 außer Betrieb ist.`,
      red: {},
    },
    {
      id: 'KY-0000', title: 'Artikel 0, vollständiger Wortlaut', date: '14.03.1902', clr: 5, kind: 'Charta', src: 'Original, Gotthelm, Tresor 0',
      body: `Der Mechanismus selbst hält den nullten Sitz. Seine Stimme wird nicht gezählt, sondern befolgt.

Wer den nullten Sitz einnimmt, spricht für den Mechanismus. Er kann ihn führen, ihm folgen oder ihn zum Schweigen bringen. Nur eines kann er nicht: so tun, als wüsste er nicht, dass es ihn gibt.

Es ist nicht vorgesehen, dass ein Mensch diesen Sitz einnimmt. Es ist auch nicht verboten.`,
      red: {},
    },
  ];

  D.fragments = {
    A: { letter: 'Α', code: 'K7TH', where: 'Depesche DSP-0412' },
    B: { letter: 'Β', code: 'SITZ', where: 'Archiv KY-0409' },
    G: { letter: 'Γ', code: 'NULL', where: 'Bildaufklärung Kythera' },
    D: { letter: 'Δ', code: '1902', where: 'PYTHIA' },
  };
  D.fullKey = 'K7TH-SITZ-NULL-1902';
})();
