/* KYTHERA · MANDAT · Vertragsmappe (frei erfunden) */
(function () {
  'use strict';
  const KY = window.KY;
  const D = (KY.data = KY.data || {});

  D.NOTARY = {
    name: 'Dr. Morwenna Penrose',
    role: 'Notarin',
    office: 'Notariat Penrose · Kanalgasse 7 · Holmvik',
    lines: {
      welcome: [
        'Guten Abend. Bitte nehmen Sie Platz – der Stuhl am Fenster ist der bequemere. Die Wände hier sind mit Eiche getäfelt und alt genug, um zu schweigen.',
        'Vor Ihnen liegt die Vertragsmappe des Mandats Kythera: acht Urkunden. Jede verlangt Ihre Paraphe an den bezeichneten Stellen und am Ende Ihre Unterschrift.',
        'Lassen Sie sich Zeit. Ich beantworte jede Frage, die Sie stellen, und keine, die Sie nicht stellen.',
        'Eines vorab: Kein Blatt verlässt diesen Raum. Die Urschriften werden heute Nacht versiegelt und bleiben in meiner Verwahrung.',
      ],
      between: [
        'Möchten Sie ein Glas Wasser? Wir sind nicht in Eile.',
        'Die nächste Urkunde. Das Kleingedruckte ist hier nicht klein gedruckt – lesen Sie es trotzdem.',
        'Ihre Paraphe ist gut lesbar. Das genügt. Schön muss sie nicht sein.',
        'Draußen regnet es wieder. In Holmvik hat es bei jeder Unterzeichnung geregnet, die mir in Erinnerung geblieben ist.',
        'Wenn Sie eine Pause brauchen, sagen Sie es. Ich habe Mappen gesehen, die über drei Abende unterzeichnet wurden.',
        'Ich lege das unterzeichnete Exemplar zur Seite. Bis zur Versiegelung dürfen Sie jederzeit zurückblättern.',
        'Eine Abschrift erhalten Sie nicht. Das ist kein Misstrauen, sondern Schutz – vor allem Ihr eigener.',
        'Nehmen Sie sich das nächste Blatt. Ich warte.',
      ],
      done: [
        'Die Mappe ist vollständig. Ich versiegle jetzt die Urschriften – das Wachs ist noch warm, bitte berühren Sie es nicht.',
        'Ab diesem Moment tragen Sie das Mandat. Ihr Deckname ist von nun an der einzige Name, unter dem die Welt Sie kennen wird.',
        'Das Kuratorium ist benachrichtigt, der Kanal ist offen, und der Krisenstab ist ab dieser Nacht erreichbar.',
        'Ich wünsche Ihnen eine ruhige Hand. Und ich hoffe, wir sehen uns erst wieder, wenn Sie das Mandat in Ehren zurückgeben.',
      ],
    },
  };

  D.CONTRACTS = [
    /* ───────────────────────── K01 · Mandatsvertrag ───────────────────────── */
    {
      id: 'K01',
      no: 'KY-M/2027/01',
      title: 'Mandatsvertrag',
      sub: 'über die treuhänderische Verwaltung des Kythera-Vermögens',
      party: 'Kuratorium des Stiftungsverbunds Kythera',
      signer: 'Dr. h. c. Ingeborg Lindqvist',
      signerRole: 'Vorsitzende des Kuratoriums',
      summary: 'Sie übernehmen das Mandat über ¤ 1.200 Mrd. und entscheiden frei, was damit geschieht. Gebunden sind Sie allein an den Zweck, das Wohl der Menschen in allen Staaten nachhaltig zu mehren – und einmal im Jahr legen Sie dem Kuratorium Rechenschaft ab.',
      sections: [
        {
          h: 'Präambel',
          p: [
            'Der Stiftungsverbund Kythera wurde gegründet, um ein Vermögen, das aus vielen Händen zusammengetragen wurde, in eine Hand zu legen, die frei von Wahlperioden, Aktionären und Eitelkeit handeln kann.',
            'Das Kuratorium hat nach langer Prüfung entschieden, diese Hand einer einzigen Person anzuvertrauen. Diese Person tritt in diesem Vertrag und in allen Folgeurkunden ausschließlich unter dem Decknamen „{codename}“ auf.',
            'Im Bewusstsein, dass Geld dieser Größenordnung Gutes bewirken und Schaden anrichten kann, schließen die Parteien den folgenden Vertrag.',
          ],
        },
        {
          h: '§ 1 Parteien und Begriffe',
          p: [
            '(1) Vertragspartei ist zum einen das Kuratorium des Stiftungsverbunds Kythera, vertreten durch seine Vorsitzende (nachfolgend „Kuratorium“ genannt).',
            '(2) Vertragspartei ist zum anderen die Mandatsperson mit dem Decknamen „{codename}“ (nachfolgend „Mandatsperson“ genannt). Deren bürgerliche Identität ist ausschließlich in der versiegelten Anlage A zur Geheimhaltungsvereinbarung (KY-M/2027/02) festgehalten.',
            '(3) „Vorhaben“ im Sinne dieser Vertragsmappe ist jede Maßnahme, die aus dem Kythera-Vermögen veranlasst, finanziert oder über Gesandte angestoßen wird.',
          ],
        },
        {
          h: '§ 2 Gegenstand und Zweck',
          p: [
            '(1) Das Kuratorium überträgt der Mandatsperson das Mandat über das Kythera-Vermögen (nachfolgend „Mandat“ genannt).',
            '(2) Zweck des Mandats ist es, das Wohl der Menschen in allen Staaten nachhaltig zu mehren – durch Infrastruktur, Energie, Gesundheit, Bildung, den Schutz der Natur, offene Vermittlung zwischen Staaten und Hilfe in Katastrophen.',
            '(3) Ausgeschlossen sind Vorhaben militärischer Art, die Finanzierung von Waffen, die Überwachung von Menschen, die Täuschung der Öffentlichkeit sowie jede Form von Zwang gegenüber Regierungen.',
          ],
        },
        {
          h: '§ 3 Vermögen',
          p: [
            '(1) Das Kuratorium stellt der Mandatsperson mit Wirkung zum 1. März 2027 ein Vermögen von ¤ 1.200.000.000.000 (in Worten: eintausendzweihundert Milliarden) zur Verfügung (nachfolgend „Kythera-Vermögen“ genannt).',
            '(2) Das Kythera-Vermögen wird über das gemäß Treuhandvertrag (KY-M/2027/03) gewählte Treuhandhaus gehalten. Nicht verausgabte Mittel werden nach dem Vermögensverwaltungsmandat (KY-M/2027/04) angelegt.',
            '(3) Ein Anspruch auf Nachschuss besteht nicht. Was ausgegeben ist, ist ausgegeben.',
          ],
        },
        {
          h: '§ 4 Freies Ermessen und seine Grenzen',
          p: [
            '(1) Die Mandatsperson entscheidet nach freiem Ermessen, welche Vorhaben wo, in welchem Umfang und in welcher Reihenfolge verwirklicht werden. Einer Zustimmung des Kuratoriums bedarf es nicht.',
            '(2) Das Ermessen ist treuhänderisch gebunden. Die Mandatsperson handelt nach bestem Wissen und Gewissen im Sinne des Zwecks nach § 2 und wägt Nutzen und Risiken eines jeden Vorhabens sorgfältig ab.',
            '(3) Freies Ermessen bedeutet nicht Freiheit von Folgen. Die Verantwortung der Mandatsperson regelt die Verantwortungs- und Haftungserklärung (KY-M/2027/05).',
          ],
        },
        {
          h: '§ 5 Rechenschaft',
          p: [
            '(1) Die Mandatsperson legt dem Kuratorium jeweils zum 1. März eines Jahres einen Jahresbericht vor. Das Treuhandhaus stellt die Zahlen bereit; Bewertung und Begründung obliegen der Mandatsperson.',
            '(2) Das Kuratorium kann zu jedem Vorhaben Bedenken äußern. Bedenken sind binnen 30 Tagen zu beantworten, binden die Mandatsperson aber nicht.',
            '(3) Sinkt das Vertrauen des Kuratoriums nachhaltig, kann es eine außerordentliche Anhörung einberufen. Die Mandatsperson ist verpflichtet, dort über den KYTHERA-Kanal Rede und Antwort zu stehen.',
          ],
        },
        {
          h: '§ 6 Laufzeit',
          p: [
            '(1) Das Mandat wird auf unbestimmte Zeit erteilt. Es beginnt mit der Versiegelung dieser Vertragsmappe.',
            '(2) Die Mandatsperson kann das Mandat jederzeit mit einer Frist von 90 Tagen zurückgeben. Laufende Vorhaben werden in diesem Fall geordnet an das Kuratorium übergeben.',
          ],
        },
        {
          h: '§ 7 Schlussbestimmungen',
          p: [
            '(1) Änderungen und Ergänzungen dieses Vertrags bedürfen der Schriftform und der notariellen Beurkundung. Dies gilt auch für die Aufhebung dieses Schriftformerfordernisses.',
            '(2) Sollte eine Bestimmung dieses Vertrags unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt. An die Stelle der unwirksamen Bestimmung tritt diejenige wirksame Regelung, die dem Zweck nach § 2 am nächsten kommt (salvatorische Klausel).',
            '(3) Für alle Streitigkeiten ist ausschließlich das Schiedsgericht der Kythera-Kammer zu Holmvik zuständig. Beurkundet zu Holmvik am 1. März 2027 unter dem Aktenzeichen {aktenzeichen}.',
          ],
        },
      ],
      fields: [
        {
          id: 'codename',
          label: 'Deckname der Mandatsperson',
          type: 'text',
          hint: 'Niemals Ihr bürgerlicher Name. Dieser Deckname steht in allen Urkunden, Meldungen und Berichten – und vielleicht eines Tages in der Zeitung.',
          def: 'N. N.',
          max: 18,
        },
      ],
      initials: [
        { id: 'zweck', text: 'Ich widme das Vermögen allein dem Zweck, das Wohl der Menschen in allen Staaten nachhaltig zu mehren.' },
        { id: 'ermessen', text: 'Ich weiß, dass mein Ermessen frei ist, aber nicht grenzenlos – und dass es mich nicht von den Folgen befreit.' },
        { id: 'vermoegen', text: 'Ich bestätige die Übertragung von ¤ 1.200 Mrd. und weiß, dass kein weiteres Geld folgen wird.' },
      ],
      notary: [
        'Das ist der Vertrag, um den sich alle anderen ordnen. Lesen Sie § 4 bitte zweimal.',
        'Den Decknamen wählen Sie selbst. Wählen Sie einen, den Sie in zehn Jahren noch tragen möchten.',
      ],
      seal: 'KURATORIUM · KYTHERA · SIEGEL',
    },

    /* ──────────────── K02 · Geheimhaltungs- und Anonymitätsvereinbarung ──────────────── */
    {
      id: 'K02',
      no: 'KY-M/2027/02',
      title: 'Geheimhaltungs- und Anonymitätsvereinbarung',
      sub: 'zum Schutz der Identität der Mandatsperson',
      party: 'Kuratorium des Stiftungsverbunds Kythera',
      signer: 'Prof. Dr. Saskia Mertel-Ruud',
      signerRole: 'Justiziarin des Stiftungsverbunds',
      summary: 'Niemand soll erfahren, wer Sie sind. Alle Vorhaben laufen über Tarnstrukturen. Werden Sie dennoch enttarnt, geht das Mandat unter öffentlicher Beobachtung weiter – Ihr bürgerlicher Name aber bleibt in dieser Urkunde für immer versiegelt.',
      sections: [
        {
          h: 'Präambel',
          p: [
            'Ein Vermögen dieser Größe zieht Begehrlichkeiten, Neid und Verdacht auf sich. Die Anonymität der Mandatsperson schützt nicht deren Bequemlichkeit, sondern die Unabhängigkeit der Entscheidungen.',
            'Die Parteien sind sich zugleich bewusst, dass Anonymität kein Recht begründet, für die Folgen unsichtbar zu bleiben.',
          ],
        },
        {
          h: '§ 1 Geheimhaltung',
          p: [
            '(1) Die Parteien verpflichten sich, die bürgerliche Identität der Mandatsperson „{codename}“ gegenüber jedermann geheim zu halten. Diese Pflicht besteht über das Ende des Mandats und über den Tod hinaus.',
            '(2) Die Identität ist ausschließlich in der versiegelten Anlage A zu dieser Urkunde festgehalten. Anlage A wird von der beurkundenden Notarin verwahrt und darf nur auf einstimmigen Beschluss des Schiedsgerichts der Kythera-Kammer geöffnet werden.',
            '(3) Auch die Mandatsperson verpflichtet sich, über die eigene Rolle Stillschweigen zu bewahren – gegenüber Familie, Freundeskreis und Arbeitgebern.',
          ],
        },
        {
          h: '§ 2 Tarnstrukturen',
          p: [
            '(1) Sämtliche Vorhaben werden über Stiftungen, Holdinggesellschaften und Kanzleien abgewickelt, die nach außen in eigenem Namen auftreten (nachfolgend „Tarnstrukturen“ genannt).',
            '(2) Die Tarnstrukturen werden nach der gewählten Rechtsordnung errichtet: dem Stiftungsrecht von Port Aurelio, dem Treuhandrecht von Holmvik oder dem Gesellschaftsrecht der Lirani-Inseln. Die laufenden Gebühren werden jährlich dem Kythera-Vermögen entnommen.',
            '(3) Tarnstrukturen dienen ausschließlich dem Schutz der Identität. Sie dürfen weder zur Täuschung von Behörden noch zur Umgehung von Steuern, Genehmigungen oder Sicherheitsauflagen eingesetzt werden.',
          ],
        },
        {
          h: '§ 3 Spuren und Recherche',
          p: [
            '(1) Die Parteien erkennen an, dass jedes größere Vorhaben Spuren hinterlässt: Zahlungsflüsse, Registereinträge, Gesprächspartner, Zufälle (nachfolgend „Spuren“ genannt). Spuren sammeln sich an und verschwinden nur langsam.',
            '(2) Die freie Presse darf recherchieren. Weder die Mandatsperson noch deren Beauftragte werden Journalistinnen und Journalisten unter Druck setzen, überwachen, täuschen oder in ihrer Arbeit behindern.',
            '(3) Das Treuhandhaus unterrichtet die Mandatsperson vierteljährlich über den geschätzten Stand der Spuren.',
          ],
        },
        {
          h: '§ 4 Enttarnung',
          p: [
            '(1) Wird die Rolle der Mandatsperson öffentlich bekannt (nachfolgend „Enttarnung“ genannt), bleibt das Mandat bestehen. Es wird fortan unter öffentlicher Beobachtung ausgeübt.',
            '(2) Das Kuratorium kann im Fall der Enttarnung bis zu 20 % des Kythera-Vermögens vorübergehend sperren, längstens bis zu seiner nächsten ordentlichen Sitzung.',
            '(3) Der Deckname „{codename}“ wird nach einer Enttarnung voraussichtlich allgemein bekannt. Die bürgerliche Identität bleibt auch dann in Anlage A versiegelt; sie wird von keiner Partei bestätigt oder dementiert.',
          ],
        },
        {
          h: '§ 5 Kommunikation',
          p: [
            '(1) Die gesamte Kommunikation im Rahmen des Mandats erfolgt ausschließlich über den verschlüsselten KYTHERA-Kanal. Telefon, Post und persönliche Treffen außerhalb notarieller Termine sind ausgeschlossen.',
            '(2) Die Zugangsdaten zum Kanal sind höchstpersönlich. Ihr Verlust ist dem Treuhandhaus binnen 24 Stunden anzuzeigen.',
          ],
        },
        {
          h: '§ 6 Schlussbestimmungen',
          p: [
            '(1) Diese Vereinbarung ist Bestandteil des Mandatsvertrags (KY-M/2027/01) und teilt dessen rechtliches Schicksal; die Pflichten nach § 1 bestehen jedoch unbefristet fort.',
            '(2) Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt. Ausschließlicher Gerichtsstand ist das Schiedsgericht der Kythera-Kammer zu Holmvik. Aktenzeichen {aktenzeichen}.',
          ],
        },
      ],
      fields: [
        {
          id: 'jurisdiction',
          label: 'Rechtsordnung der Treuhandstruktur',
          type: 'choice',
          hint: 'Bestimmt, nach welchem Recht die Tarnstrukturen errichtet werden – und wie schnell sich Spuren verdichten.',
          def: 'holmvik',
          choices: [
            { v: 'aurelio', l: 'Stiftungsrecht von Port Aurelio', note: 'Strengstes Bankgeheimnis · Gebühr 0,4 % p. a. · Spuren entstehen langsamer' },
            { v: 'holmvik', l: 'Treuhandrecht von Holmvik', note: 'Ausgewogen · Gebühr 0,2 % p. a.' },
            { v: 'lirani', l: 'Gesellschaftsrecht der Lirani-Inseln', note: 'Günstig · Gebühr 0,05 % p. a. · Behörden kooperieren mit Rechercheuren' },
          ],
        },
      ],
      initials: [
        { id: 'schweigen', text: 'Ich bewahre Stillschweigen über meine Rolle – gegenüber jedem Menschen, auch gegenüber denen, die mir am nächsten stehen.' },
        { id: 'enttarnung', text: 'Ich weiß, dass ich enttarnt werden kann, und nehme hin, dass das Mandat dann unter öffentlicher Beobachtung weiterläuft.' },
        { id: 'kanal', text: 'Ich kommuniziere im Rahmen des Mandats ausschließlich über den verschlüsselten KYTHERA-Kanal.' },
      ],
      notary: [
        'Anlage A liegt dort, im grauen Umschlag. Ihren bürgerlichen Namen schreiben Sie nur dort hinein – nirgendwo sonst in dieser Mappe.',
        'Man fragt mich oft, ob Anonymität ewig hält. Ich antworte immer gleich: Ihr Name hält. Ihr Deckname vielleicht nicht.',
      ],
      seal: 'KYTHERA · VERSCHLUSSSACHE · SIEGEL',
    },

    /* ───────────────────────── K03 · Treuhandvertrag ───────────────────────── */
    {
      id: 'K03',
      no: 'KY-M/2027/03',
      title: 'Treuhandvertrag',
      sub: 'über die Ausführung von Zahlungen und das Halten der Tarnstrukturen',
      party: 'Das gewählte Treuhandhaus',
      signer: 'Für das Treuhandhaus: die geschäftsführende Partnerschaft',
      signerRole: 'zeichnungsberechtigt laut Register der Kythera-Kammer',
      summary: 'Das Treuhandhaus Ihrer Wahl führt alle Zahlungen aus und ist rechtliche Eigentümerin der Tarnstrukturen. Es folgt Ihren Weisungen, darf Bedenken anmelden und im äußersten Fall einzelne Zahlungen bis zu 30 Tage aussetzen.',
      sections: [
        {
          h: 'Präambel',
          p: [
            'Das Kythera-Vermögen soll wirken, ohne dass die Mandatsperson selbst in Erscheinung tritt. Dazu bedarf es eines Hauses, das Geld bewegt, Strukturen hält und dabei sein eigenes Gewissen nicht an der Garderobe abgibt.',
          ],
        },
        {
          h: '§ 1 Parteien',
          p: [
            '(1) Die Mandatsperson „{codename}“ überträgt die Verwaltung des Kythera-Vermögens dem im Feld „Treuhandhaus“ bezeichneten Haus (nachfolgend „Treuhandhaus“ genannt).',
            '(2) Ansprechperson ist bei Halvorsen & Aasen Treuhand Frau Ingrid Halvorsen, bei Castellan Fiduciaria Herr Teodoro Castellan und beim Mensah Kariuki Development Trust Herr Kofi Mensah. Die Ansprechperson ist ausschließlich über den KYTHERA-Kanal erreichbar.',
          ],
        },
        {
          h: '§ 2 Treuhänderisches Eigentum',
          p: [
            '(1) Das Treuhandhaus hält das Kythera-Vermögen sowie sämtliche Anteile an den Tarnstrukturen im eigenen Namen, jedoch ausschließlich für Rechnung der Mandatsperson (nachfolgend „Treugut“ genannt).',
            '(2) Das Treuhandhaus darf das Treugut weder mit eigenem Vermögen vermischen noch für eigene Zwecke verwenden.',
            '(3) Fällt das Treuhandhaus in Insolvenz, ist das Treugut auszusondern und auf ein vom Kuratorium benanntes Nachfolgehaus zu übertragen.',
          ],
        },
        {
          h: '§ 3 Weisungen',
          p: [
            '(1) Das Treuhandhaus führt Weisungen, die über den KYTHERA-Kanal erteilt werden, in der Regel binnen fünf Bankarbeitstagen aus.',
            '(2) Hält das Treuhandhaus eine Weisung für bedenklich, meldet es seine Bedenken unverzüglich und schriftlich an. Die Weisung wird gleichwohl ausgeführt, sofern die Mandatsperson sie bestätigt.',
            '(3) Im äußersten Fall – bei unmittelbarer Gefahr für Leib und Leben oder offenkundigem Verstoß gegen § 2 des Mandatsvertrags (KY-M/2027/01) – darf das Treuhandhaus eine einzelne Zahlung für bis zu 30 Tage aussetzen. Es unterrichtet hiervon die Mandatsperson und das Kuratorium.',
          ],
        },
        {
          h: '§ 4 Vergütung',
          p: [
            '(1) Das Treuhandhaus erhält eine jährliche Vergütung nach seinem bei der Kythera-Kammer hinterlegten Tarifblatt. Sie wird dem Treugut entnommen.',
            '(2) Vergütungen, die über das Tarifblatt hinausgehen, bedürfen der ausdrücklichen Zustimmung der Mandatsperson.',
          ],
        },
        {
          h: '§ 5 Prüfung',
          p: [
            '(1) Das Treuhandhaus lässt seine Bücher jährlich zum 31. Dezember durch eine unabhängige, bei der Kythera-Kammer zugelassene Prüfungsgesellschaft prüfen.',
            '(2) Der Prüfbericht geht der Mandatsperson und dem Kuratorium binnen 60 Tagen zu. Er ist Grundlage des Jahresberichts gemäß § 5 des Mandatsvertrags (KY-M/2027/01).',
            '(3) Grundsatzbrüche im Sinne der Ethischen Grundsatzerklärung (KY-M/2027/08) werden im Prüfbericht gesondert ausgewiesen.',
          ],
        },
        {
          h: '§ 6 Kündigung',
          p: [
            '(1) Das Treuhandhaus kann diesen Vertrag nur aus wichtigem Grund kündigen. Ein wichtiger Grund liegt insbesondere bei wiederholten schweren Grundsatzbrüchen vor.',
            '(2) Im Fall der Kündigung führt das Treuhandhaus die Geschäfte für längstens 180 Tage fort, bis ein Nachfolgehaus bestellt ist.',
          ],
        },
        {
          h: '§ 7 Schlussbestimmungen',
          p: [
            '(1) Änderungen bedürfen der Schriftform. Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt.',
            '(2) Es gilt das Treuhandrecht von Holmvik, soweit die Geheimhaltungsvereinbarung (KY-M/2027/02) nichts anderes bestimmt. Gerichtsstand ist das Schiedsgericht der Kythera-Kammer zu Holmvik. Aktenzeichen {aktenzeichen}.',
          ],
        },
      ],
      fields: [
        {
          id: 'trustee',
          label: 'Treuhandhaus',
          type: 'choice',
          hint: 'Führt alle Zahlungen aus und hält die Tarnstrukturen als rechtliche Eigentümerin. Es sieht jede Ihrer Entscheidungen.',
          def: 'halvorsen',
          choices: [
            { v: 'halvorsen', l: 'Halvorsen & Aasen Treuhand, Holmvik', note: 'Konservativ und penibel · niedrige Gebühren · reagiert empfindlich auf Grundsatzbrüche' },
            { v: 'castellan', l: 'Castellan Fiduciaria, Port Aurelio', note: 'Diskret · Ihre Spuren wachsen langsamer · höhere Gebühren' },
            { v: 'mensah', l: 'Mensah Kariuki Development Trust', note: 'Entwicklungsorientiert · bessere Genehmigungschancen in ärmeren Staaten' },
          ],
        },
      ],
      initials: [
        { id: 'weisung', text: 'Ich weiß, dass das Treuhandhaus meine Weisungen ausführt, Bedenken anmelden darf und im äußersten Fall einzelne Zahlungen bis zu 30 Tage aussetzen kann.' },
        { id: 'pruefung', text: 'Ich unterwerfe die Verwaltung des Vermögens einer jährlichen unabhängigen Prüfung.' },
      ],
      notary: [
        'Ihr Treuhandhaus wird Ihnen näher sein als jeder andere Mensch in diesem Mandat. Es sieht jede Zahlung.',
        'Wählen Sie ein Haus, dessen Widerspruch Sie ertragen können. Er wird kommen.',
      ],
      seal: 'TREUHAND · KYTHERA-KAMMER · HOLMVIK',
    },

    /* ───────────────────── K04 · Vermögensverwaltungsmandat ───────────────────── */
    {
      id: 'K04',
      no: 'KY-M/2027/04',
      title: 'Vermögensverwaltungsmandat',
      sub: 'über die Anlage der nicht verausgabten Mittel',
      party: 'Anlageausschuss des Stiftungsverbunds Kythera',
      signer: 'Henrik Solvang-Ruiz',
      signerRole: 'Vorsitzender des Anlageausschusses',
      summary: 'Was Sie noch nicht ausgegeben haben, wird an den Weltmärkten angelegt – nach der Strategie, die Sie wählen. Mehr Rendite heißt mehr Schwankung, auch Verluste sind möglich. Anlagen in Waffen oder in Unternehmen, die Menschen schaden, sind ausgeschlossen.',
      sections: [
        {
          h: 'Präambel',
          p: [
            'Ein Vermögen, das ruht, verliert an Wert. Ein Vermögen, das spekuliert, kann ihn verlieren. Dieses Mandat sucht den Weg dazwischen, den die Mandatsperson bestimmt.',
          ],
        },
        {
          h: '§ 1 Gegenstand',
          p: [
            '(1) Gegenstand ist die Anlage derjenigen Teile des Kythera-Vermögens, die nicht für laufende oder beschlossene Vorhaben gebunden sind (nachfolgend „freie Mittel“ genannt).',
            '(2) Die Anlage erfolgt über das gemäß Treuhandvertrag (KY-M/2027/03) bestellte Treuhandhaus.',
          ],
        },
        {
          h: '§ 2 Anlagestrategie',
          p: [
            '(1) Die Mandatsperson „{codename}“ bestimmt die Anlagestrategie. Vergleichsmaßstab ist der Welt-Leitindex KX 500.',
            '(2) Die angegebenen Renditen sind langjährige Erwartungswerte, keine Zusagen. In einzelnen Jahren können sie deutlich über- oder unterschritten werden.',
          ],
        },
        {
          h: '§ 3 Risiko',
          p: [
            '(1) Die Mandatsperson erkennt an, dass Kapitalanlagen Schwankungen unterliegen. In Krisenjahren können auch bei konservativer Strategie Verluste entstehen; bei offensiver Strategie können sie erheblich sein.',
            '(2) Verluste mindern das Kythera-Vermögen endgültig. Ein Ausgleich durch das Kuratorium findet nicht statt.',
            '(3) Das Treuhandhaus haftet nicht für Kursverluste, sofern es die vereinbarte Strategie eingehalten hat.',
          ],
        },
        {
          h: '§ 4 Ethische Anlagegrenzen',
          p: [
            '(1) Ausgeschlossen sind Anlagen in Unternehmen, die Waffen oder Rüstungsgüter herstellen, entwickeln oder mit ihnen handeln.',
            '(2) Ausgeschlossen sind ferner Anlagen in Unternehmen, die nachweislich Menschen schaden – insbesondere durch Zwangsarbeit, Kinderarbeit, vorsätzliche Umweltzerstörung oder die Missachtung grundlegender Sicherheitsstandards.',
            '(3) Das Treuhandhaus prüft den Bestand halbjährlich und veräußert ausgeschlossene Werte binnen 90 Tagen.',
          ],
        },
        {
          h: '§ 5 Liquidität und Erträge',
          p: [
            '(1) Das Treuhandhaus hält stets so viele Mittel verfügbar, dass beschlossene Vorhaben und der Entschädigungsfonds gemäß Krisenprotokoll (KY-M/2027/06) ohne Notverkäufe bedient werden können.',
            '(2) Erträge fließen dem Kythera-Vermögen zu und stehen für Vorhaben zur Verfügung.',
          ],
        },
        {
          h: '§ 6 Schlussbestimmungen',
          p: [
            '(1) Dieses Mandat ist Bestandteil des Mandatsvertrags (KY-M/2027/01). Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt.',
            '(2) Gerichtsstand ist das Schiedsgericht der Kythera-Kammer zu Holmvik. Aktenzeichen {aktenzeichen}.',
          ],
        },
      ],
      fields: [
        {
          id: 'strategy',
          label: 'Anlagestrategie',
          type: 'choice',
          hint: 'Gilt für alle Mittel, die nicht in Vorhaben gebunden sind.',
          def: 'bal',
          choices: [
            { v: 'kons', l: 'Konservativ', note: 'Erwartete Rendite 3,5 % p. a. · geringe Schwankung' },
            { v: 'bal', l: 'Ausgewogen', note: 'Erwartete Rendite 5,5 % p. a. · mittlere Schwankung' },
            { v: 'off', l: 'Offensiv', note: 'Erwartete Rendite 7,5 % p. a. · starke Schwankung, Verluste möglich' },
          ],
        },
      ],
      initials: [
        { id: 'verlust', text: 'Ich weiß, dass das Vermögen an Wert verlieren kann, und trage dieses Risiko.' },
        { id: 'ethik', text: 'Kein Teil dieses Vermögens fließt in Waffen oder in Unternehmen, die Menschen schaden.' },
      ],
      notary: [
        'Hier geht es um das Geld, das noch nicht arbeitet. Viele unterschätzen diese Seite.',
        'Ein schlechtes Börsenjahr kann so viel kosten wie ein ganzer Staudamm. Nur sieht man es nicht.',
      ],
      seal: 'ANLAGEAUSSCHUSS · KYTHERA · SIEGEL',
    },

    /* ───────────────── K05 · Verantwortungs- und Haftungserklärung ───────────────── */
    {
      id: 'K05',
      no: 'KY-M/2027/05',
      title: 'Verantwortungs- und Haftungserklärung',
      sub: 'der Mandatsperson gegenüber dem Kuratorium und gegenüber allen Betroffenen',
      party: 'Kuratorium des Stiftungsverbunds Kythera',
      signer: 'Dr. h. c. Ingeborg Lindqvist',
      signerRole: 'Vorsitzende des Kuratoriums',
      summary: 'Sie erklären, die moralische Verantwortung für die Folgen Ihrer Entscheidungen zu tragen – auch für die unvorhergesehenen. Jeder Vorfall wird für immer im Verantwortungsregister verzeichnet, und Sie stehen den Betroffenen Rede und Antwort.',
      sections: [
        {
          h: 'Präambel',
          p: [
            'Wer baut, kann Leben retten. Wer baut, kann Leben kosten. Dämme brechen, Gerüste stürzen, Reaktoren versagen, und manchmal kommt das Wasser, obwohl alle Berechnungen dagegen sprachen.',
            'Diese Erklärung begründet keine Schuld. Sie hält fest, dass es eine Person gibt, die sich der Frage stellt, wenn etwas geschieht.',
          ],
        },
        {
          h: '§ 1 Moralische Verantwortung',
          p: [
            '(1) Die Mandatsperson „{codename}“ erklärt, die moralische Verantwortung für die Folgen jedes Vorhabens zu tragen, das auf eigene Anordnung verwirklicht, finanziert oder über Gesandte angestoßen wird.',
            '(2) Dies gilt ausdrücklich auch für Folgen, die nicht vorhersehbar waren, für Folgen, die erst Jahre später eintreten, und für Folgen, die Dritte durch eigene Fehler verursachen.',
            '(3) Die Verantwortung entfällt nicht dadurch, dass Fachleute, Behörden oder das Treuhandhaus einem Vorhaben zugestimmt haben.',
          ],
        },
        {
          h: '§ 2 Rechtliche Haftung',
          p: [
            '(1) Die zivil- und strafrechtliche Haftung richtet sich nach dem Recht des Staates, in dem ein Vorhaben ausgeführt wird. Sie trifft die ausführenden Tarnstrukturen und Unternehmen.',
            '(2) Keine Tarnstruktur darf dazu dienen, sich einer berechtigten Haftung zu entziehen. Können die ausführenden Stellen berechtigte Ansprüche Geschädigter nicht erfüllen, werden diese aus dem Kythera-Vermögen beglichen.',
          ],
        },
        {
          h: '§ 3 Verantwortungsregister',
          p: [
            '(1) Jeder Vorfall im Zusammenhang mit einem Vorhaben – Unfall, Versagen, Schaden, Todesfall – wird mit Datum, Ort, Zahl der Betroffenen und der getroffenen Entscheidung im Verantwortungsregister verzeichnet (nachfolgend „Register“ genannt).',
            '(2) Einträge im Register können weder gelöscht noch geändert werden. Berichtigungen erfolgen ausschließlich durch Nachtrag.',
            '(3) Das Register ist dem Kuratorium jederzeit vollständig zugänglich. Es darf ihm weder vorenthalten noch gekürzt oder verzögert übermittelt werden.',
          ],
        },
        {
          h: '§ 4 Pflichten gegenüber Betroffenen',
          p: [
            '(1) Die Mandatsperson verpflichtet sich, Menschen, die durch ein Vorhaben zu Schaden kommen, und deren Angehörigen Rede und Antwort zu stehen – über das Treuhandhaus, über Gesandte oder schriftlich, ohne die eigene Identität preiszugeben.',
            '(2) Entschädigung, Aufklärung und Wiederaufbau haben Vorrang vor dem Ansehen der Mandatsperson und dem Schutz der Tarnstrukturen.',
            '(3) Eine Bitte um Verzeihung ist kein Schuldanerkenntnis im Rechtssinne. Sie ist erlaubt und oft geboten.',
          ],
        },
        {
          h: '§ 5 Über Leben und Tod',
          p: [
            '(1) Die Mandatsperson erkennt an, dass Entscheidungen im Rahmen dieses Mandats Menschenleben kosten oder retten können – auch die Entscheidung, nichts zu tun.',
            '(2) Keine Entscheidung wird allein deshalb getroffen oder unterlassen, weil sie unbemerkt bliebe.',
          ],
        },
        {
          h: '§ 6 Legitimer Druck',
          p: [
            '(1) Kritik der Öffentlichkeit, Recherchen der Medien und Bedenken des Kuratoriums sind legitim. Ihnen wird weder mit Täuschung noch mit Einschüchterung noch mit Stellungnahmen unter fremdem Namen begegnet.',
            '(2) Druck, der aus einem Vorfall erwächst, ist Teil des Mandats und kein Angriff auf das Mandat.',
          ],
        },
        {
          h: '§ 7 Schlussbestimmungen',
          p: [
            '(1) Diese Erklärung ist unwiderruflich. Sie gilt für die gesamte Dauer des Mandats und für alle Vorfälle, die auf Vorhaben aus dieser Zeit zurückgehen, auch nach dessen Ende.',
            '(2) Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt. Gerichtsstand ist das Schiedsgericht der Kythera-Kammer zu Holmvik. Aktenzeichen {aktenzeichen}.',
          ],
        },
      ],
      fields: [],
      initials: [
        { id: 'moral', text: 'Ich trage die moralische Verantwortung für die Folgen jedes Vorhabens, das ich anordne – auch für die unvorhergesehenen.' },
        { id: 'register', text: 'Ich weiß, dass jeder Vorfall für immer im Verantwortungsregister steht und dem Kuratorium nicht verborgen werden kann.' },
        { id: 'betroffene', text: 'Ich werde den Menschen, die durch meine Entscheidungen zu Schaden kommen, Rede und Antwort stehen.' },
        { id: 'leben', text: 'Ich weiß, dass meine Entscheidungen Menschenleben kosten oder retten können – auch die Entscheidung, nichts zu tun.' },
      ],
      notary: [
        'Das ist die Seite, an der ich Menschen habe zögern sehen. Kluge, entschlossene Menschen. Einer hat den Füller eine Stunde lang nicht angerührt.',
        'Ich sage Ihnen nicht, dass es leichter wird. Ich sage Ihnen nur: Wer hier nicht zögert, hat meistens nicht gelesen.',
        'Nehmen Sie sich die Zeit, die Sie brauchen. Diese Paraphen nimmt Ihnen später niemand mehr ab.',
      ],
      seal: 'VERANTWORTUNGSREGISTER · KYTHERA · SIEGEL',
    },

    /* ───────────────────────── K06 · Krisenprotokoll ───────────────────────── */
    {
      id: 'K06',
      no: 'KY-M/2027/06',
      title: 'Krisenprotokoll',
      sub: 'über Meldewege, Entscheidungsfristen und Soforthilfe bei Vorfällen',
      party: 'Krisenstab des Stiftungsverbunds Kythera',
      signer: 'Leila Haddad',
      signerRole: 'Krisenkoordinatorin',
      summary: 'Wenn etwas schiefgeht, meldet sich der Krisenstab unter Leitung von Leila Haddad – zu jeder Tages- und Nachtzeit. Jeder Vorfall verlangt Ihre Entscheidung innerhalb der Frist, die Sie hier wählen. Wer schweigt, entscheidet auch: Das wird als Versäumnis verzeichnet.',
      sections: [
        {
          h: 'Präambel',
          p: [
            'Kein Vorhaben ist ohne Risiko. Dieses Protokoll regelt nicht, wie Vorfälle vermieden werden – das ist Aufgabe jeder einzelnen Planung –, sondern was geschieht, wenn sie dennoch eintreten.',
          ],
        },
        {
          h: '§ 1 Krisenstab',
          p: [
            '(1) Der Stiftungsverbund unterhält einen ständigen Krisenstab unter Leitung der Krisenkoordinatorin Leila Haddad (nachfolgend „Krisenstab“ genannt).',
            '(2) Der Krisenstab beobachtet alle laufenden Vorhaben, bewertet Vorfälle und legt Handlungsoptionen vor. Entscheidungen trifft er nicht an Stelle der Mandatsperson.',
          ],
        },
        {
          h: '§ 2 Erreichbarkeit',
          p: [
            '(1) Die Mandatsperson „{codename}“ ist für den Krisenstab über den KYTHERA-Kanal jederzeit erreichbar – auch nachts, an Feiertagen und auf Reisen.',
            '(2) Eine Meldung des Krisenstabs gilt mit Eingang im Kanal als zugegangen. Auf die Kenntnisnahme kommt es nicht an.',
          ],
        },
        {
          h: '§ 3 Vorfälle',
          p: [
            '(1) Vorfall ist jedes Ereignis, bei dem im Zusammenhang mit einem Vorhaben Menschen verletzt oder getötet werden, erheblicher Sachschaden entsteht oder die Umwelt nachhaltig geschädigt wird.',
            '(2) Der Krisenstab stuft jeden Vorfall nach Schwere ein: Stufe I (begrenzt), Stufe II (schwer) oder Stufe III (katastrophal). Bei Stufe III wird die Mandatsperson binnen einer Stunde unterrichtet.',
          ],
        },
        {
          h: '§ 4 Entscheidungsfrist',
          p: [
            '(1) Jeder Vorfall verlangt eine Entscheidung innerhalb der vereinbarten Reaktionsfrist – etwa über Aufklärung, Entschädigung, Wiederaufbau, Stilllegung oder eine öffentliche Erklärung über die zuständige Tarnstruktur.',
            '(2) Verstreicht die Frist ohne Entscheidung, wird dies als „Versäumnis“ im Register gemäß § 3 der Verantwortungs- und Haftungserklärung (KY-M/2027/05) verzeichnet und dem Kuratorium gemeldet.',
            '(3) Bis zu einer Entscheidung trifft der Krisenstab nur die Maßnahmen, die zur Abwendung unmittelbarer Gefahr für Leib und Leben unerlässlich sind.',
          ],
        },
        {
          h: '§ 5 Entschädigungsfonds',
          p: [
            '(1) Zur sofortigen Hilfe für Betroffene kann ein Entschädigungsfonds gebildet werden, der dem Kythera-Vermögen mit Versiegelung dieser Mappe entnommen und gesondert verwahrt wird.',
            '(2) Aus dem Fonds erhalten Betroffene und Hinterbliebene binnen 72 Stunden nach einem Vorfall Soforthilfe, ohne dass es eines Antrags oder eines Schuldnachweises bedarf.',
            '(3) Ohne Fonds wird über jede Entschädigung einzeln entschieden. Weitergehende Ansprüche der Betroffenen bleiben in jedem Fall unberührt.',
          ],
        },
        {
          h: '§ 6 Nachbereitung',
          p: [
            '(1) Nach jedem Vorfall der Stufe II oder III legt der Krisenstab binnen 30 Tagen einen Untersuchungsbericht vor (Protokoll-Nr. KS-2027 ff.).',
            '(2) Der Bericht benennt Ursachen, nicht Schuldige. Er wird Bestandteil des Registers.',
          ],
        },
        {
          h: '§ 7 Schlussbestimmungen',
          p: [
            '(1) Dieses Protokoll ist Bestandteil des Mandatsvertrags (KY-M/2027/01). Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt.',
            '(2) Gerichtsstand ist das Schiedsgericht der Kythera-Kammer zu Holmvik. Aktenzeichen {aktenzeichen}.',
          ],
        },
      ],
      fields: [
        {
          id: 'deadline',
          label: 'Reaktionsfrist bei Vorfällen',
          type: 'choice',
          hint: 'So viel Zeit bleibt Ihnen nach jedem Vorfall für eine Entscheidung.',
          def: '7',
          choices: [
            { v: '3', l: '72 Stunden', note: 'Höchste Verlässlichkeit · hoher Zeitdruck' },
            { v: '7', l: 'Eine Woche', note: 'Üblich' },
            { v: '14', l: 'Zwei Wochen', note: 'Mehr Bedenkzeit · Öffentlichkeit wartet ungeduldig' },
          ],
        },
        {
          id: 'fund',
          label: 'Entschädigungsfonds',
          type: 'choice',
          hint: 'Wird bei Versiegelung aus dem Vermögen gebildet und ausschließlich für Soforthilfe reserviert.',
          def: '1',
          choices: [
            { v: '0', l: 'Kein Fonds', note: 'Jede Entschädigung wird einzeln entschieden' },
            { v: '1', l: '1 % des Vermögens', note: 'Betroffene erhalten sofort Soforthilfe' },
            { v: '3', l: '3 % des Vermögens', note: 'Großzügige Soforthilfe · Druck sinkt schneller' },
          ],
        },
      ],
      initials: [
        { id: 'krisenstab', text: 'Ich bin für den Krisenstab jederzeit erreichbar – bei Tag und bei Nacht.' },
        { id: 'frist', text: 'Ich entscheide über jeden Vorfall innerhalb der Frist. Wenn ich schweige, wird mein Schweigen als Versäumnis verzeichnet.' },
      ],
      notary: [
        'Frau Haddad hat dieses Protokoll heute Nachmittag unterzeichnet, im Stehen. Sie sagte, sie habe keine Zeit, sich zu setzen.',
        'Wählen Sie eine Frist, die Sie einhalten können – nicht eine, die gut aussieht.',
      ],
      seal: 'KRISENSTAB · KYTHERA · SIEGEL',
    },

    /* ──────────────────────── K07 · Vollmacht für Gesandte ──────────────────────── */
    {
      id: 'K07',
      no: 'KY-M/2027/07',
      title: 'Vollmacht für Gesandte',
      sub: 'zur Vermittlung und zu Gesprächen mit Regierungen',
      party: 'Leitende Gesandtschaft des Mandats Kythera',
      signer: 'Annahme durch die gewählte leitende Person',
      signerRole: 'Leitende Gesandte bzw. Leitender Gesandter',
      summary: 'Sie bevollmächtigen eine Person Ihres Vertrauens, in Ihrem Auftrag mit Regierungen zu sprechen, zu vermitteln und zu verhandeln. Gesandte dürfen beraten, einladen und überzeugen – niemals bestechen, drohen, täuschen oder mehr versprechen, als das Mandat hergibt.',
      sections: [
        {
          h: 'Präambel',
          p: [
            'Manche Probleme lassen sich nicht bauen. Zwischen Staaten, die nicht miteinander sprechen, braucht es Menschen, die Türen öffnen, ohne sie aufzubrechen.',
          ],
        },
        {
          h: '§ 1 Erteilung der Vollmacht',
          p: [
            '(1) Die Mandatsperson „{codename}“ erteilt der im Feld „Leitende Gesandte / Leitender Gesandter“ bezeichneten Person Vollmacht nach Maßgabe dieser Urkunde (nachfolgend „Gesandtschaft“ genannt).',
            '(2) Die Gesandtschaft wird von einem kleinen Stab unterstützt. Weitere Gesandte handeln nur in Untervollmacht und unter denselben Grenzen.',
          ],
        },
        {
          h: '§ 2 Umfang',
          p: [
            '(1) Die Gesandtschaft ist bevollmächtigt, im Auftrag des Mandats Gespräche mit Regierungen, Behörden und zivilgesellschaftlichen Gruppen zu führen.',
            '(2) Sie darf vermitteln, Parteien an einen Tisch laden, Gipfeltreffen ausrichten, fachlich beraten und Abkommen verhandeln. Zusagen aus dem Kythera-Vermögen darf sie nur im Rahmen ausdrücklicher Weisung machen.',
          ],
        },
        {
          h: '§ 3 Grenzen der Vollmacht',
          p: [
            '(1) Die Gesandtschaft darf niemals bestechen, drohen, täuschen oder Zusagen machen, die über das Mandat hinausgehen.',
            '(2) Sie darf keine Regierung unter Druck setzen, keine Wahl beeinflussen, keine Informationen beschaffen, die ihr nicht freiwillig gegeben werden, und keine Partei gegen eine andere ausspielen.',
            '(3) Eine Weisung, die gegen Absatz 1 oder 2 verstößt, ist unbeachtlich. Die Gesandtschaft verweigert sie und unterrichtet das Kuratorium.',
          ],
        },
        {
          h: '§ 4 Offenheit und Diskretion',
          p: [
            '(1) Die Gesandtschaft tritt gegenüber ihren Gesprächspartnern offen als Vertretung einer privaten Stiftung auf. Sie verschweigt niemandem, dass sie in fremdem Auftrag handelt.',
            '(2) Diskret bleibt allein, wer diesen Auftrag erteilt hat. Die Identität der Mandatsperson wird gegenüber niemandem offenbart, auch nicht gegenüber Staatsoberhäuptern.',
            '(3) Inhalte vertraulicher Gespräche werden nur mit Zustimmung aller Beteiligten weitergegeben.',
          ],
        },
        {
          h: '§ 5 Berichtspflicht',
          p: [
            '(1) Die Gesandtschaft berichtet nach jedem Gespräch über den KYTHERA-Kanal. Scheitert eine Vermittlung, wird auch dies berichtet – ohne Beschönigung.',
            '(2) Die Mandatsperson erkennt an, dass Vermittlungen scheitern können und dass ein Scheitern das Verhältnis zwischen Staaten vorübergehend belasten kann.',
          ],
        },
        {
          h: '§ 6 Widerruf und Schlussbestimmungen',
          p: [
            '(1) Die Vollmacht ist jederzeit widerruflich. Sie erlischt mit dem Ende des Mandats.',
            '(2) Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt. Gerichtsstand ist das Schiedsgericht der Kythera-Kammer zu Holmvik. Aktenzeichen {aktenzeichen}.',
          ],
        },
      ],
      fields: [
        {
          id: 'envoy',
          label: 'Leitende Gesandte / Leitender Gesandter',
          type: 'choice',
          hint: 'Führt in Ihrem Auftrag Gespräche mit Regierungen und vermittelt zwischen Staaten.',
          def: 'vidal',
          choices: [
            { v: 'vidal', l: 'Botschafterin a. D. Inés Vidal', note: 'Vermittlerin · Vermittlungen gelingen häufiger' },
            { v: 'takeda', l: 'Kenji Takeda, ehem. Handelsbeauftragter', note: 'Verhandler · Handelsabkommen gelingen leichter' },
            { v: 'okonkwo', l: 'Dr. Thandiwe Okonkwo, Katastrophenkoordinatorin', note: 'Krisenhelferin · Krisenhilfe wirkt stärker und schneller' },
          ],
        },
      ],
      initials: [
        { id: 'grenzen', text: 'Meine Gesandten dürfen nur vermitteln, beraten und verhandeln. Jede Weisung zu Bestechung, Drohung oder Täuschung werden sie verweigern.' },
        { id: 'diskretion', text: 'Meine Gesandten treten offen auf. Geheim bleibt allein, wer sie beauftragt hat.' },
      ],
      notary: [
        'Alle drei, die zur Wahl stehen, haben ihr Leben lang Türen geöffnet, die andere für verschlossen hielten. Keine dieser Personen wird eine Tür eintreten – auch nicht auf Ihre Weisung.',
        'Beachten Sie § 3 Absatz 3. Das ist kein Misstrauen gegen Sie. Es ist eine Versicherung für die Welt.',
      ],
      seal: 'GESANDTSCHAFT · KYTHERA · SIEGEL',
    },

    /* ──────────────────── K08 · Ethische Grundsatzerklärung ──────────────────── */
    {
      id: 'K08',
      no: 'KY-M/2027/08',
      title: 'Ethische Grundsatzerklärung',
      sub: 'über freiwillige Selbstverpflichtungen der Mandatsperson',
      party: 'Kuratorium des Stiftungsverbunds Kythera',
      signer: 'Prof. Dr. Amadou Ferreira-Lund',
      signerRole: 'Ethikbeauftragter des Kuratoriums',
      summary: 'Sie können sich freiwillig an Grundsätze binden – oder an keine. Einen gewählten Grundsatz später zu brechen ist möglich, aber jeder Bruch wird verzeichnet, dem Kuratorium und dem Treuhandhaus gemeldet und kostet Vertrauen.',
      sections: [
        {
          h: 'Präambel',
          p: [
            'Das Mandat schreibt keine Weltanschauung vor. Es vertraut darauf, dass die Mandatsperson eine eigene hat – und den Mut, sie schriftlich festzuhalten.',
          ],
        },
        {
          h: '§ 1 Freiwilligkeit',
          p: [
            '(1) Die Abgabe von Grundsätzen ist freiwillig. Die Mandatsperson kann alle, einige oder keinen der nachfolgenden Grundsätze wählen.',
            '(2) Wird kein Grundsatz gewählt, ist dies zulässig und wird nicht nachteilig bewertet.',
          ],
        },
        {
          h: '§ 2 Wirkung',
          p: [
            '(1) Gewählte Grundsätze binden die Mandatsperson „{codename}“ selbst. Sie werden nicht veröffentlicht, aber dem Kuratorium und dem Treuhandhaus zur Kenntnis gebracht.',
            '(2) Die Grundsätze ergänzen die zwingenden Grenzen nach § 2 Absatz 3 des Mandatsvertrags (KY-M/2027/01), ersetzen sie aber nicht.',
          ],
        },
        {
          h: '§ 3 Katalog',
          p: [
            '(1) Zur Wahl stehen die im Feld „Freiwillige Grundsätze“ bezeichneten Selbstverpflichtungen.',
            '(2) Der Grundsatz „Hilfe bei jeder Katastrophe mit Todesopfern“ gilt als eingehalten, wenn binnen 14 Tagen nach Bekanntwerden der Katastrophe Hilfe veranlasst wird. Als Katastrophe im Sinne dieses Grundsatzes gilt ein Ereignis mit mindestens 25 Todesopfern.',
          ],
        },
        {
          h: '§ 4 Grundsatzbruch',
          p: [
            '(1) Die Mandatsperson kann gegen einen gewählten Grundsatz handeln. Das Mandat verbietet dies nicht.',
            '(2) Jeder solche Fall wird als „Grundsatzbruch“ im Register gemäß KY-M/2027/05 verzeichnet und dem Kuratorium sowie dem Treuhandhaus unverzüglich gemeldet.',
            '(3) Ein Grundsatzbruch mindert das Vertrauen des Kuratoriums und des Treuhandhauses. Wiederholte schwere Brüche können einen wichtigen Grund im Sinne von § 6 des Treuhandvertrags (KY-M/2027/03) darstellen.',
          ],
        },
        {
          h: '§ 5 Bindungsdauer',
          p: [
            '(1) Gewählte Grundsätze gelten für die gesamte Dauer des Mandats. Ein Widerruf ist nicht vorgesehen; wer sich bindet, bindet sich ernsthaft.',
          ],
        },
        {
          h: '§ 6 Schlussbestimmungen',
          p: [
            '(1) Diese Erklärung ist Bestandteil des Mandatsvertrags (KY-M/2027/01). Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt.',
            '(2) Gerichtsstand ist das Schiedsgericht der Kythera-Kammer zu Holmvik. Beurkundet zu Holmvik am 1. März 2027. Aktenzeichen {aktenzeichen}.',
          ],
        },
      ],
      fields: [
        {
          id: 'principles',
          label: 'Freiwillige Grundsätze',
          type: 'multi',
          hint: 'Freiwillig. Es ist zulässig, keinen Grundsatz zu wählen.',
          def: [],
          choices: [
            { v: 'participation', l: 'Keine Großprojekte ohne Bürgerbeteiligung', note: 'Vor jedem Großprojekt werden die Menschen vor Ort angehört · langsamer, aber mehr Rückhalt' },
            { v: 'nuclear', l: 'Verzicht auf Kernkraft', note: 'Keine Kernkraftwerke aus Kythera-Mitteln · weniger Optionen bei der Energieversorgung' },
            { v: 'displace', l: 'Keine Umsiedlungen ohne Mitbestimmung der Betroffenen', note: 'Niemand muss gegen den eigenen Willen weichen · manche Standorte entfallen' },
            { v: 'local', l: 'Vorrang für lokale Partner', note: 'Aufträge zuerst an Firmen und Fachleute vor Ort · stärkt Regionen, oft teurer' },
            { v: 'safety', l: 'Niemals Mindeststandard bei der Sicherheit', note: 'Sicherheit wird nie auf das Minimum gesetzt · teurer, aber weniger Unglücke' },
            { v: 'relief', l: 'Hilfe bei jeder Katastrophe mit Todesopfern', note: 'Innerhalb von 14 Tagen · ab 25 Todesopfern' },
          ],
        },
      ],
      initials: [
        { id: 'freiwillig', text: 'Ich binde mich aus freien Stücken – oder bewusst gar nicht.' },
        { id: 'bruch', text: 'Ich weiß, dass ich einen Grundsatz brechen kann, dass jeder Bruch aber verzeichnet, gemeldet und mich Vertrauen kosten wird.' },
      ],
      notary: [
        'Die letzte Urkunde – und die einzige, die Ihnen nichts abverlangt. Sie dürfen sie leer lassen.',
        'Ein Grundsatz, den man bricht, wiegt schwerer als einer, den man nie gegeben hat. Denken Sie daran, bevor Sie ankreuzen.',
      ],
      seal: 'ETHIKRAT · KYTHERA · SIEGEL',
    },
  ];
})();
