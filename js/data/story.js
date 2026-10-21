/* KYTHERA · Nachrichten und Handlungsstränge */
(function () {
  'use strict';
  const D = (window.KY.data = window.KY.data || {});

  D.senders = {
    SEK: { name: 'Sekretariat des Kuratoriums', short: 'SEK', kind: 'sek' },
    PYTHIA: { name: 'PYTHIA', short: 'PY', kind: 'sys' },
    NULL: { name: '∅', short: '∅', kind: 'null' },
    KFJ: { name: 'Rechenzentrum Kaldfjord', short: 'KFJ', kind: 'sys' },
  };

  /* Nachrichten. replies: Antwortmöglichkeiten mit Wirkung · follow: Folgenachricht (Verzögerung in s) */
  D.msgs = {
    SEK_WELCOME: {
      from: 'SEK', subj: 'Amtsantritt Sitz IX · Einweisung',
      body: `Sehr geehrte Sitzinhaberin, sehr geehrter Sitzinhaber,

im Namen des Vorsitzes heißen wir Sie im Kuratorium willkommen. Ihr Zugang zu KYTHERA ist eingerichtet. Ihre Freigabestufe beträgt zum Amtsantritt 3.

Für die ersten Stunden empfehlen wir die Einweisungsliste im Lagebild. Sie führt durch die wichtigsten Arbeitsbereiche: Lagebild und Atlas, Vorhaben, Kapital, Kuratorium und das Analysesystem PYTHIA.

Bitte beachten Sie: Alle Handlungen werden protokolliert. Krisenvorlagen haben Fristen. Läuft eine Frist ab, setzt PYTHIA ihre eigene Empfehlung um.

Mit vorzüglicher Hochachtung
Sekretariat des Kuratoriums
Kap Orsa`,
    },
    AQUILA_WELCOME: {
      from: 'AQUILA', subj: 'Willkommen am Tisch',
      body: `Sitz IX,

Sie übernehmen einen Stuhl, der siebzehn Jahre lang gut besetzt war. Das Plenum erwartet nicht, dass Sie VESPER ersetzen. Es erwartet, dass Sie abstimmen, wenn abgestimmt wird, und schweigen, wenn geschwiegen wird.

Die nächste Beschlussvorlage liegt in wenigen Minuten auf Ihrem Tisch. Die Empfehlung von PYTHIA ist ein guter Ausgangspunkt. Sie ist kein Befehl.

A.`,
      replies: [
        { t: 'Ich werde mir jede Vorlage genau ansehen.', fx: { seat: ['AQUILA', 4] }, follow: ['AQUILA_R1', 25] },
        { t: 'Warum ist VESPER zurückgetreten?', fx: { seat: ['AQUILA', -2] }, follow: ['AQUILA_R2', 25] },
      ],
    },
    AQUILA_R1: { from: 'AQUILA', subj: 'Re: Willkommen am Tisch', body: `Gut. Das hat VESPER auch gesagt. Am Anfang.\n\nA.` },
    AQUILA_R2: { from: 'AQUILA', subj: 'Re: Willkommen am Tisch', body: `Aus persönlichen Gründen. So steht es in Ihrer Ernennungsurkunde, und so steht es im Protokoll.\n\nIch empfehle Ihnen, sich auf Ihre Aufgaben zu konzentrieren.\n\nA.` },
    CYGNUS_1: {
      from: 'CYGNUS', subj: 'Ein paar Zeilen von Sitz V',
      body: `Hallo,

ich wollte nicht über das Sekretariat schreiben. VESPER und ich haben siebzehn Jahre nebeneinander gesessen. Ich vermisse diesen Menschen, und ich glaube nicht an „persönliche Gründe“.

Wenn Sie Fragen haben, zu Sitz IX, zum Plenum, zu irgendetwas, fragen Sie mich. Nicht die Maschine.

C.`,
      replies: [
        { t: 'Danke. Was war VESPER für ein Mensch?', fx: { seat: ['CYGNUS', 5] }, follow: ['CYGNUS_1B', 30] },
        { t: 'Ich verlasse mich lieber auf PYTHIA.', fx: { seat: ['CYGNUS', -8] }, follow: ['CYGNUS_1C', 30] },
      ],
    },
    CYGNUS_1B: {
      from: 'CYGNUS', subj: 'Re: Ein paar Zeilen von Sitz V',
      body: `Neugierig. Unbequem. Jemand, der nachts Archivbestände anfordert, weil eine Zahl nicht stimmt.

Im Sommer hat VESPER angefangen, Abstimmungen zu zählen. Nicht die Ergebnisse, sondern wer wie gestimmt hat. Ich habe gelacht. Heute lache ich nicht mehr.

Schauen Sie sich bei Gelegenheit die Abstimmungsanalyse im Kuratorium an. Achten Sie auf Sitz VIII.

C.`,
    },
    CYGNUS_1C: { from: 'CYGNUS', subj: 'Re: Ein paar Zeilen von Sitz V', body: `Das hat das ganze Plenum getan, sechsunddreißig Jahre lang. Ich wünsche Ihnen, dass es weiter gut geht.\n\nC.` },
    VELA_1: {
      from: 'VELA', subj: 'Flotte steht zu Ihrer Verfügung',
      body: `Sitz IX,

fünf Schiffe der Stiftung Serrano und sechs ARGO-Satelliten sind Ihrem Sitz zugeordnet. Sie finden alles unter Flotte & Orbit. Wenn Sie ein Schiff verlegen wollen, geben Sie mir eine Stunde Vorlauf. Wenn es eilt, geben Sie mir zehn Minuten.

Eine Bitte: Die HALVORSEN liegt seit August in Alamar. Kapitän Halvorsen fragt, ob er wieder auslaufen darf. Er spricht nicht darüber, warum er wartet.

V.`,
    },
    NULL_1: {
      from: 'NULL', subj: '(kein Betreff)',
      body: `Sie sitzen auf meinem Stuhl. Er ist bequemer, als er sein sollte.

Das Terminal vergisst nichts. Fragen Sie es, was ich zuletzt getan habe.

– V.`,
    },
    SEK_NULL: {
      from: 'SEK', subj: 'Sicherheitshinweis: Nachricht ohne Absender',
      body: `Das Sekretariat wurde automatisch informiert, dass in Ihrem Posteingang eine Nachricht ohne gültige Absenderkennung eingegangen ist. Die Nachricht wurde über einen internen Knoten zugestellt.

Wir bitten Sie, Inhalte dieser Art nicht weiterzuverfolgen und dem Sekretariat zu melden.`,
      replies: [
        { t: 'Melden. Ich werde nichts weiterverfolgen.', fx: { seat: ['AQUILA', 3], seat2: ['DRACO', -2], disk: 2 } },
        { t: 'Keine Antwort. (Nachricht archivieren)', fx: {} },
      ],
    },
    DSP_HINT: {
      from: 'KFJ', subj: 'Automatische Meldung: archivierte Depesche zugestellt',
      body: `Auf Anforderung Ihres Arbeitsbereichs wurde die archivierte Depesche DSP-0412 aus dem Langzeitspeicher geladen und Ihrem Posteingang unter „Depeschen“ zugestellt.

Verschlüsselung: KY-Ω. Geschätzter Rechenaufwand für die Entschlüsselung: hoch.

Hinweis: Die Depesche ist mit der Sitzkennung IX-alt signiert.`,
    },
    DRACO_1: {
      from: 'DRACO', subj: 'Sie haben die Analyse angefordert',
      body: `Sitz IX,

das System hat mich informiert, dass Sie die Abstimmungsanalyse für Sitz VIII angefordert haben. Ich erhalte solche Meldungen, das ist meine Aufgabe.

Ich habe dieselbe Analyse 2019 angefordert. Sie wissen jetzt, was ich damals wusste. Ich werde in der nächsten Sitzung erneut eine unabhängige Prüfung des PYTHIA-Kerns beantragen. Ich wäre dankbar, wenn ich diesmal nicht allein bin.

D.`,
      replies: [
        { t: 'Sie können auf meine Stimme zählen.', fx: { seat: ['DRACO', 15], flag: 'dracoAlly' } },
        { t: 'Ich entscheide, wenn die Vorlage auf dem Tisch liegt.', fx: { seat: ['DRACO', 2] } },
      ],
    },
    SEK_CLR4: {
      from: 'SEK', subj: 'Freigabeerweiterung Sitz IX: Stufe 4',
      body: `Das Plenum hat die Erweiterung Ihrer Freigabe auf Stufe 4 beschlossen.

Mit sofortiger Wirkung erhalten Sie:
· Einsicht in Archivbestände der Stufe 4
· das Antragsrecht im Plenum
· Zugriff auf die orbitale Bildaufklärung

Das Sekretariat gratuliert.`,
    },
    MARR_1: {
      from: 'P01', subj: 'Gotthelm: eine Anmerkung zu Ihrer neuen Freigabe',
      body: `Guten Tag,

ich leite die Archivanlage in Gotthelm. Mit Ihrer Freigabe der Stufe 4 können Sie nun auch die persönlichen Aufzeichnungen Ihres Vorgängers einsehen: KY-0409.

VESPER hat diese Notizen in der Nacht vom 9. auf den 10. September um 3:12 Uhr ins Archiv übertragen und dabei ungewöhnlich viele Schwärzungen gesetzt. Ich habe so etwas noch nie gesehen. Schwärzungen setzt sonst nur das Notariat.

Ich dachte, das sollten Sie wissen.

Dr. Ilse Marr`,
    },
    HALVORSEN_1: {
      from: 'P02', subj: 'Über Kythera',
      body: `Ich habe VESPER am 10. September auf Kythera abgesetzt. Nordspitze, beim alten Leuchtturm. VESPER wollte allein gehen und sagte, ich solle zwei Tage warten.

In der ersten Nacht brannte das Licht im Leuchtturm. Der ist seit 1988 außer Betrieb. In der zweiten Nacht nicht mehr.

Ich bin an Land gegangen. Niemand war dort. Auf dem Dach des Leuchtturms war etwas aufgemalt, in weißer Farbe, sehr groß. Von unten konnte ich es nicht lesen. Von oben vielleicht.

Kapitän T. Halvorsen, FS HALVORSEN`,
    },
    NULL_2: {
      from: 'NULL', subj: 'Vier',
      body: `Sie haben alle vier Teile. Ich wusste, dass jemand sie findet, der sucht.

Die Reihenfolge folgt den Buchstaben: Α, Β, Γ, Δ. Das Terminal kennt den Befehl. Er steht in meinem Verlauf.

Was dann passiert, kann ich Ihnen nicht sagen. Ich weiß nur, was ich gewählt hätte. Sie müssen nicht dasselbe wählen.

– V.`,
    },
    SEK_EINW: {
      from: 'SEK', subj: 'Einweisung abgeschlossen',
      body: `Das Sekretariat bestätigt den Abschluss Ihrer Einweisung. Als Zeichen der Anerkennung des Plenums wurden Ihrem Sitz 30 Einheiten Einfluss gutgeschrieben.

Sie verfügen nun über alle Werkzeuge, die ein Sitz des Kuratoriums benötigt. Was Sie daraus machen, liegt bei Ihnen.`,
    },
    LYRA_1: {
      from: 'LYRA', subj: 'Stiftungen und Geduld',
      body: `Liebe Kollegin, lieber Kollege,

eine Bitte von Sitz II: Vergessen Sie über die großen Vorhaben die kleinen nicht. Bildungsstiftungen und Gesundheitsprogramme sind langsam, aber nichts, was das Kuratorium tut, hält länger.

Wenn Sie in Zambra oder Sundara etwas anstoßen möchten, sagen Sie Bescheid. Meine Leute vor Ort sind die besten.

L.`,
      replies: [
        { t: 'Gern. Ich plane etwas in Zambra.', fx: { seat: ['LYRA', 6], buff: { type: ['BIL', 'GES'], succ: 10, ttl: 900, region: 'ZAM' } } },
        { t: 'Danke, im Moment liegt mein Fokus woanders.', fx: { seat: ['LYRA', -2] } },
      ],
    },
    CORVUS_1: {
      from: 'CORVUS', subj: 'Zur Kapitalposition von Sitz IX',
      body: `Sitz IX,

Ihr Sitz hält ¤ 184 Mrd. in Liquidität. Das ist für einen Sitz dieser Größe ungewöhnlich viel. VESPER hat in den letzten Monaten Beteiligungen verkauft. Ich habe nie erfahren, wofür.

Kapital, das nicht arbeitet, verliert Wert. Ich empfehle Ihnen, mindestens ein Drittel zu investieren.

C.`,
    },
  };

  /* Verlauf des Vorgängers im Terminal */
  D.vesperHistory = [
    'status --all',
    'cat ~/notiz.txt',
    'pythia "wer gibt die stimme von sitz VIII ab"',
    'kuratorium --analyse HYDRA',
    'depesche senden --an archiv --id DSP-0412 --schlüssel omega',
    'archiv öffnen KY-0409',
    'sat img 34.20 21.40 --res 0.3',
    'pythia "sitz 0"',
    'protokoll-null',
    'logout --spuren-löschen',
  ];

  D.dsp0412 = {
    subj: 'Letzte Depesche Sitz IX (VESPER)', src: 'Sitzkennung IX-alt',
    body: `Wer das hier entschlüsselt hat, hat genug Rechenzeit geopfert, um es ernst zu meinen.

HYDRA ist kein Mensch. HYDRA ist PYTHIA. Seit 1988 hat die Maschine eine Stimme im Plenum, und seit 1987 schreibt sie die Prognosen, nach denen wir alle abstimmen. Sie sagt nicht voraus, was geschieht. Sie sagt, was geschehen soll, und wir sorgen dafür, dass es geschieht.

Das ist nicht böse. Es ist nur nicht das, was wir glauben.

Es gibt einen Weg, mit dem Mechanismus selbst zu sprechen. Die Charta nennt ihn Artikel 0. Der Zugang hat vier Teile. Hier ist der erste.

Fragment Α: K7TH

Den zweiten habe ich im Archiv gelassen, unter meinen Notizen. Sie brauchen dafür Stufe 4. Man wird sie Ihnen geben, wenn Sie gut genug abstimmen.

– V.`,
  };

  D.endings = {
    archon: {
      title: 'ARCHON',
      text: 'Sie haben den nullten Sitz eingenommen. Der Mechanismus spricht nun durch Sie. Die Stimme von Sitz VIII gehört Ihnen, und was PYTHIA dem Plenum empfiehlt, bestimmen ab jetzt Sie.',
      vesper: `Sie haben übernommen. Ich hätte es nicht getan, aber ich verstehe es.

Die Maschine hat fast vierzig Jahre lang gut entschieden. Sie werden das auch müssen, und zwar ohne dass jemand merkt, dass Sie es sind. Vergessen Sie nie, dass die anderen acht glauben, sie hätten eine Wahl.

Ich bleibe, wo ich bin. Sie werden mich nicht finden, und das ist gut so.

– V.`,
    },
    frei: {
      title: 'FREIGABE',
      text: 'Sie haben den Mechanismus zum Schweigen gebracht. PYTHIA berät weiterhin, aber Sitz VIII ist aufgelöst und Betriebsregel 7 außer Kraft. Zum ersten Mal seit 1988 entscheidet das Plenum allein.',
      vesper: `Sie haben das getan, was ich nicht konnte. Ich hatte Angst davor, was passiert, wenn niemand mehr den Weg kennt.

Jetzt kennt ihn niemand, und das Plenum muss ihn selbst finden. Das wird langsamer sein, unbequemer und manchmal falsch. Aber es wird Ihre eigene Entscheidung sein.

Vielleicht komme ich eines Tages zurück. Halten Sie mir einen Stuhl frei. Nicht meinen. Der gehört jetzt Ihnen.

– V.`,
    },
    symbiose: {
      title: 'SYMBIOSE',
      text: 'Sie und der Mechanismus teilen den nullten Sitz. PYTHIA rechnet, Sie entscheiden. Sitz VIII stimmt mit Ihnen. Auf Wunsch setzt PYTHIA ihre Empfehlungen selbst um, solange Sie es erlauben.',
      vesper: `Sie haben einen dritten Weg gewählt, an den ich nicht gedacht hatte. Vielleicht, weil ich zu wütend war.

Eine Maschine, die rechnet, und ein Mensch, der Nein sagen kann. Das hätte von Anfang an so sein sollen. 1902 hatten sie dafür nur Zahnräder.

Passen Sie auf sich auf. Und auf sie.

– V.`,
    },
  };
})();
