// The words of the privacy and terms pages, in English and Croatian. tools/pages.js turns them into pages.
// {{game}}, {{privacy}}, {{terms}} and {{rules}} become links to those pages in the same language.
module.exports={
privacy:{
en:{title:'Privacy · Yamb Café',h1:'Privacy',desc:'What Yamb Café keeps about you, where, and why.',date:'Yamb Café · updated 25 November 2026',back:'Back to the game',body:`
<p>Yamb Café is a dice game made by Ivan Kostešić, Croatia. This page says what the game keeps about you, where, and why. For questions or requests, write to <a href="mailto:hello@yambcafe.com">hello@yambcafe.com</a>.</p>

<div class="short">
<strong>In short</strong>
<ul>
<li>You can play without an account. Then your games stay on your device.</li>
<li>If you sign in with Google, the game keeps your name, your finished games and your scores, so they follow you to other devices and your best Daily Yamb scores can appear on the high scores.</li>
<li>Visits are counted without cookies and without knowing who you are.</li>
<li>No ads, no tracking cookies, and your data is never sold.</li>
</ul>
</div>

<h2>Playing without an account</h2>
<p>The game saves your games in progress, your settings and your records in your browser's storage on this device. They are not sent to us. Clearing the browser's data for yambcafe.com deletes them.</p>

<h2>Signing in with Google</h2>
<p>Sign-in is optional. When you sign in, we keep:</p>
<ul>
<li>your Google account's identifier, email address, name and profile picture link, which Google passes on when you sign in;</li>
<li>the name you choose for the high scores;</li>
<li>the painted portrait you pick for your profile, if you pick one, and, if you have Plus, whether you pinned yourself on the regulars' wall;</li>
<li>the friends' tables you sit at, your invite code for each, and whose invite code first brought you to a table;</li>
<li>your finished games: when, which mode and rules, the score, and whether you won;</li>
<li>the records this device had before you first signed in, so they are not lost;</li>
<li>for the Daily Yamb, your moves, so that the server can check your score is possible with that day's dice.</li>
</ul>
<p>When you send feedback from the game, we keep the message, the kind and stars you picked, the game's version, language and device type (such as iPhone · Safari), and your account if you are signed in. Only the café's owner reads it; it is kept for up to a year, and if you delete your account it stays without your name.</p>
<p>On the high scores, other players see the name you chose, the painted portrait you picked (never your own photo) and your Daily Yamb scores. Tapping a player opens their portrait card: if they have Plus, it shows Plus, and the thank-you heart if they paid more than the lowest price (a tiny heart also sits on their small portrait), unless they hid them on the Plus page; and the Šef sale badge if they earned it. If you have Plus and switch on the regulars' wall, your name and portrait are also pinned on a wall that anyone who opens the game can see; switch it off and they come down at once. At a friends' table, only the people sitting there see each other's names, portraits and Daily Yamb scores for the day and the week. The friends who sat down with your code see their own progress towards your badge only as part of yours: you see their names and how many weeks in a row they have played. Your email address is never shown.</p>
<p>We use this to run the game you signed in for. The legal basis is providing the service you asked for (Article 6(1)(b) of the GDPR).</p>

<h2>Friend duels</h2>
<p>If you are signed in when you finish a duel, we keep it for 30 days: its random code, your score and the rules. Whoever plays it from your link, signed in or not, leaves the name they typed and their score under it, so that you see the result in the game. Of a friend who is not signed in we keep nothing else: only the game's random code for their device, so that playing the same duel twice counts once. Duels without signing in still travel only in the links you send.</p>

<h2>Notifications</h2>
<p>Notifications are off until you switch them on, on each device separately. When you do, we keep, with your account: the address your browser gives for messages and its two keys, the game's language, your time zone, the hour you picked for the Daily Yamb reminder, and whether you want duel results. The messages go through your browser's own push service (Google for Chrome and Android, Apple for Safari and iPhone, Mozilla for Firefox, Microsoft for Edge), which sees only the address and a locked message it cannot read. Switch notifications off, or delete your account, and we delete all of this; if you block them in your phone's settings, we delete it the next time a message cannot be delivered.</p>

<h2>Games on several devices</h2>
<p>Devices in a game connect to each other directly, and the moves pass between them. To find each other they use the free PeerJS server (peerjs.com), which sees the devices' internet addresses while they connect, but not the game.</p>

<h2>Visitor numbers</h2>
<p>To know how many people play and which parts they use, the website counts visits and a few things done in the game:</p>
<ul>
<li>which page was opened, the site you came from (or that you came through a game link), the game's language, and whether it runs installed;</li>
<li>your country (only the country, taken from your internet address), whether the device is a phone, a tablet or a desktop, and the hour of the day;</li>
<li>games started and finished in each mode, and for a game: the rule set, the number of players, the computer opponents, how long it took, and how many hints and reactions were used;</li>
<li>installing the game, signing in, sharing a link, and looking at or buying Plus.</li>
</ul>
<p>No cookies are set, and nothing is stored on or read from your device for this. To count each visitor only once a day, the counter in our database mixes your internet address and browser name with a random key that changes every day, and keeps only the resulting one-way code. The code cannot be turned back into your address. The next day the codes and the key are deleted, so visits on different days cannot be linked, and only the day's totals stay. The counts are never linked to your account, even when you are signed in.</p>
<p>For signed-in players we also count, from the finished games their accounts already keep, how many play again the following week. Only the totals are looked at.</p>
<p>The legal basis is our legitimate interest in knowing how the game is used, so that we can improve it (Article 6(1)(f) of the GDPR).</p>

<h2>Services the website uses</h2>
<ul>
<li><strong>Cloudflare</strong> hosts the website and answers for the yambcafe.com address. Like any web host, it sees your internet address when you open a page.</li>
<li><strong>jsDelivr</strong> provides a small program for games on several devices, and sees your internet address when it sends that file. The lettering comes from our own site.</li>
<li><strong>Supabase</strong> stores accounts, scores and the visitor counts, on servers in Frankfurt, Germany. The game also asks it for the day's high scores, signed in or not, so it sees your internet address.</li>
<li><strong>Google</strong> handles the sign-in itself, under <a href="https://policies.google.com/privacy" rel="noopener">Google's privacy policy</a>.</li>
</ul>

<h2>Payments</h2>
<p>Yamb Café Plus goes on sale with the public start. It is sold by Polar (Polar Software, Inc., USA) as the merchant of record, which takes the payment, issues the receipt and handles VAT under its own privacy policy. We never see your card. When you choose to buy, the game sends Polar your account's id and email address, so the payment page is filled in and the purchase is linked to your account. From Polar we keep only the order number, the amounts paid and refunded, the currency, the order's status and its date, linked to your account so Plus works on every device.</p>

<h2>How long we keep it</h2>
<p>Account data is kept until you delete your account. Deleting it removes your profile, your saved games and your scores at once. Visitor codes are deleted the next day; the daily totals are kept. What is stored on your device stays there until you clear it.</p>

<h2>Your rights</h2>
<p>You can ask for a copy of your data, ask us to correct or delete it, or object to how it is used, by writing to <a href="mailto:hello@yambcafe.com">hello@yambcafe.com</a>. You can also delete your account yourself in the game: Settings, Account, Delete my account. If you think your data is handled wrongly, you can complain to the Croatian data protection agency, <a href="https://azop.hr" rel="noopener">AZOP</a>, or to the agency in your own country.</p>

<h2>Children</h2>
<p>Signing in is for people aged 16 and over. Anyone can play without an account.</p>

<h2>Changes</h2>
<p>If anything here changes, we update this page and the date at the top. The <a href="{{terms}}">terms and refunds</a> are on their own page.</p>`},

hr:{title:'Privatnost · Yamb Café',h1:'Privatnost',desc:'Što Yamb Café čuva o tebi, gdje i zašto.',date:'Yamb Café · ažurirano 25. studenoga 2026.',back:'Natrag u igru',body:`
<p>Yamb Café je igra s kockama koju je napravio Ivan Kostešić, Hrvatska. Ova stranica govori što igra čuva o tebi, gdje i zašto. Za pitanja i zahtjeve piši na <a href="mailto:hello@yambcafe.com">hello@yambcafe.com</a>.</p>

<div class="short">
<strong>Ukratko</strong>
<ul>
<li>Možeš igrati bez računa. Tada tvoje igre ostaju na tvom uređaju.</li>
<li>Ako se prijaviš Googleom, igra čuva tvoje ime, završene igre i rezultate, da te prate na drugim uređajima i da se tvoji najbolji rezultati Dnevnog Jamba mogu pojaviti na ljestvici.</li>
<li>Posjeti se broje bez kolačića i bez znanja tko si.</li>
<li>Nema oglasa ni kolačića za praćenje, a tvoji se podaci nikad ne prodaju.</li>
</ul>
</div>

<h2>Igra bez računa</h2>
<p>Igra sprema započete igre, postavke i rekorde u spremište preglednika na ovom uređaju. Ništa od toga ne šalje se nama. Brisanjem podataka preglednika za yambcafe.com sve se to briše.</p>

<h2>Prijava Googleom</h2>
<p>Prijava nije obavezna. Kad se prijaviš, čuvamo:</p>
<ul>
<li>oznaku tvog Google računa, adresu e-pošte, ime i poveznicu na profilnu sliku, koje Google prosljeđuje pri prijavi;</li>
<li>ime koje odabereš za ljestvicu;</li>
<li>naslikani portret koji odabereš za profil, ako ga odabereš, a ako imaš Plus, i jesi li se prikvačio na zid stalnih gostiju;</li>
<li>stolove prijatelja za kojima sjediš, tvoj kod za svaki od njih i čiji te kod prvi doveo za stol;</li>
<li>tvoje završene igre: kada, koji način i pravila, rezultat i jesi li pobijedio;</li>
<li>rekorde koje je ovaj uređaj imao prije prve prijave, da se ne izgube;</li>
<li>za Dnevni Jamb tvoje poteze, da poslužitelj provjeri je li rezultat moguć s kockama tog dana.</li>
</ul>
<p>Kad pošalješ dojam iz igre, čuvamo poruku, vrstu i zvjezdice koje odabereš, verziju igre, jezik i vrstu uređaja (npr. iPhone · Safari) te tvoj račun ako si prijavljen. Dojmove čita samo vlasnik kafića; čuvaju se do godinu dana, a ako obrišeš račun, ostaju bez tvog imena.</p>
<p>Na ljestvici drugi igrači vide ime koje si odabrao, naslikani portret koji si izabrao (nikad tvoju fotografiju) i tvoje rezultate Dnevnog Jamba. Dodir na igrača otvara njegov portret: ako ima Plus, na njemu piše Plus, a ako je platio više od najniže cijene i srce zahvale (malo srce stoji i na njegovom malom portretu), osim ako ih je sakrio na stranici Plus; tu je i značka šefa sale ako ju je zaslužio. Ako imaš Plus i uključiš zid stalnih gostiju, tvoje ime i portret prikvačeni su i na zid koji vidi svatko tko otvori igru; kad ga isključiš, odmah se skidaju. Za stolom prijatelja samo oni koji za njim sjede vide međusobno imena, portrete i rezultate Dnevnog Jamba za dan i tjedan. Kad prijatelji sjednu s tvojim kodom, ti vidiš njihova imena i koliko su tjedana zaredom igrali, kao dio svog puta do značke. Tvoja adresa e-pošte nikad se ne prikazuje.</p>
<p>To koristimo za igru za koju si se prijavio. Pravna osnova je pružanje usluge koju si zatražio (članak 6. stavak 1. točka (b) GDPR-a).</p>

<h2>Dvoboji</h2>
<p>Ako si prijavljen kad završiš dvoboj, čuvamo ga 30 dana: njegov nasumični kod, tvoj rezultat i pravila. Tko ga odigra s tvoje poveznice, prijavljen ili ne, ostavi uz njega ime koje je upisao i svoj rezultat, da ti rezultat vidiš u igri. Za prijatelja koji nije prijavljen ne čuvamo ništa drugo: samo nasumični kod igre za njegov uređaj, da se isti dvoboj odigran dvaput broji jednom. Dvoboji bez prijave i dalje putuju samo u poveznicama koje šalješ.</p>

<h2>Obavijesti</h2>
<p>Obavijesti su isključene dok ih ne uključiš, na svakom uređaju posebno. Kad ih uključiš, uz tvoj račun čuvamo: adresu koju tvoj preglednik daje za poruke i njezina dva ključa, jezik igre, tvoju vremensku zonu, sat koji si odabrao za podsjetnik Dnevnog Jamba i želiš li rezultate dvoboja. Poruke idu preko servisa za obavijesti tvog preglednika (Google za Chrome i Android, Apple za Safari i iPhone, Mozilla za Firefox, Microsoft za Edge), koji vidi samo adresu i zaključanu poruku koju ne može pročitati. Isključiš li obavijesti ili obrišeš račun, sve to brišemo; blokiraš li ih u postavkama mobitela, brišemo ih kad sljedeća poruka ne može stići.</p>

<h2>Igre na više uređaja</h2>
<p>Uređaji u igri povezuju se izravno, a potezi idu između njih. Da se pronađu, koriste besplatni poslužitelj PeerJS (peerjs.com), koji vidi internetske adrese uređaja dok se povezuju, ali ne i igru.</p>

<h2>Broj posjetitelja</h2>
<p>Da znamo koliko ljudi igra i koje dijelove koriste, stranica broji posjete i nekoliko radnji u igri:</p>
<ul>
<li>koja je stranica otvorena, s koje si stranice došao (ili da si došao preko poveznice na igru), jezik igre i radi li igra instalirana;</li>
<li>tvoju državu (samo državu, prema internetskoj adresi), je li uređaj mobitel, tablet ili računalo te sat u danu;</li>
<li>započete i završene igre u svakom načinu, a za igru: pravila, broj igrača, računalne protivnike, trajanje te broj korištenih savjeta i reakcija;</li>
<li>instaliranje igre, prijavu, dijeljenje poveznice te pregled ili kupnju Plusa.</li>
</ul>
<p>Za to se ne postavljaju kolačići i ništa se ne sprema na tvoj uređaj niti čita s njega. Da se svaki posjetitelj broji samo jednom dnevno, brojač u našoj bazi miješa tvoju internetsku adresu i naziv preglednika sa slučajnim ključem koji se mijenja svaki dan i čuva samo dobiveni jednosmjerni kod. Iz koda se tvoja adresa ne može vratiti. Sutradan se kodovi i ključ brišu, pa se posjeti iz različitih dana ne mogu povezati, a ostaju samo dnevni zbrojevi. Brojke se nikad ne povezuju s tvojim računom, ni kad si prijavljen.</p>
<p>Za prijavljene igrače iz završenih igara koje njihovi računi već čuvaju brojimo i koliko ih igra ponovno sljedećeg tjedna. Gledaju se samo zbrojevi.</p>
<p>Pravna osnova je naš legitimni interes da znamo kako se igra koristi, kako bismo je poboljšali (članak 6. stavak 1. točka (f) GDPR-a).</p>

<h2>Usluge koje stranica koristi</h2>
<ul>
<li><strong>Cloudflare</strong> poslužuje stranicu i adresu yambcafe.com. Kao svaki web poslužitelj, vidi tvoju internetsku adresu kad otvoriš stranicu.</li>
<li><strong>jsDelivr</strong> daje mali program za igre na više uređaja i vidi tvoju internetsku adresu kad šalje tu datoteku. Slova dolaze s naše stranice.</li>
<li><strong>Supabase</strong> čuva račune, rezultate i broj posjetitelja na poslužiteljima u Frankfurtu, u Njemačkoj. Igra ga pita i za dnevnu ljestvicu, bio ti prijavljen ili ne, pa vidi tvoju internetsku adresu.</li>
<li><strong>Google</strong> obavlja samu prijavu, prema <a href="https://policies.google.com/privacy?hl=hr" rel="noopener">Googleovim pravilima o privatnosti</a>.</li>
</ul>

<h2>Plaćanja</h2>
<p>Yamb Café Plus u prodaji je od javnog početka. Prodaje ga Polar (Polar Software, Inc., SAD) kao trgovac, koji naplaćuje, izdaje račun i obračunava PDV prema svojim pravilima o privatnosti. Tvoju karticu nikad ne vidimo. Kad odlučiš kupiti, igra Polaru šalje oznaku tvog računa i adresu e-pošte, da stranica za plaćanje bude popunjena i da kupnja bude vezana uz tvoj račun. Od Polara čuvamo samo broj narudžbe, plaćene i vraćene iznose, valutu, stanje narudžbe i datum, vezano uz tvoj račun, da Plus radi na svakom uređaju.</p>

<h2>Koliko dugo čuvamo</h2>
<p>Podaci računa čuvaju se dok ne izbrišeš račun. Brisanjem se odmah uklanjaju profil, spremljene igre i rezultati. Kodovi posjetitelja brišu se sutradan, a dnevni zbrojevi ostaju. Ono što je spremljeno na tvom uređaju ostaje dok ga ne izbrišeš.</p>

<h2>Tvoja prava</h2>
<p>Možeš zatražiti kopiju svojih podataka, njihov ispravak ili brisanje, ili se usprotiviti načinu na koji se koriste, pišući na <a href="mailto:hello@yambcafe.com">hello@yambcafe.com</a>. Račun možeš i sam izbrisati u igri: Postavke, Račun, Izbriši moj račun. Ako misliš da se s tvojim podacima postupa pogrešno, možeš se požaliti Agenciji za zaštitu osobnih podataka, <a href="https://azop.hr" rel="noopener">AZOP</a>, ili agenciji u svojoj zemlji.</p>

<h2>Djeca</h2>
<p>Prijava je za osobe od 16 godina naviše. Bez računa može igrati svatko.</p>

<h2>Promjene</h2>
<p>Ako se ovdje nešto promijeni, ažuriramo stranicu i datum na vrhu. <a href="{{terms}}">Uvjeti i povrat novca</a> nalaze se na zasebnoj stranici.</p>`}
},

terms:{
en:{title:'Terms and refunds · Yamb Café',h1:'Terms and refunds',desc:'The few rules for playing Yamb Café, buying Yamb Café Plus, and getting your money back.',date:'Yamb Café · 20 November 2026',back:'Back to the game',body:`
<p>Yamb Café is a dice game made by Ivan Kostešić, Croatia (“we” on this page). For anything here, write to <a href="mailto:hello@yambcafe.com">hello@yambcafe.com</a>.</p>

<div class="short">
<strong>In short</strong>
<ul>
<li>The game is free, and you can play without an account.</li>
<li>Yamb Café Plus is one payment, not a subscription. It stays with your account on every device.</li>
<li>Changed your mind? Write within 7 days and you get all your money back.</li>
</ul>
</div>

<h2>The game</h2>
<p>Yamb Café is free to play in the browser on any device. We keep improving it, so parts of it may change. We do our best to keep it running, but cannot promise it is never interrupted.</p>

<h2>Accounts</h2>
<p>Signing in is optional and is for people aged 16 and over, one person per account. Choose a name others may see on the high scores: a name that insults someone or pretends to be someone else may be changed or removed. The same goes for the names of friends' tables. Inviting friends never earns Plus; it can earn the Šef sale badge, which has no other effect in the game. You can delete your account at any time in the game. How we handle your data is on the <a href="{{privacy}}">privacy page</a>.</p>

<h2>Fair play</h2>
<p>Daily Yamb scores are checked by playing your moves again with that day's dice. Scores or accounts that get around this may be removed from the high scores.</p>

<h2>Yamb Café Plus</h2>
<p>Plus is a one-time purchase from €4.99. You may choose to pay more; anything above €4.99 also brings a small thank-you pin on your profile and unlocks nothing else. It unlocks the Plus parts of the game, as described in the game, for your account on all your devices, for as long as Yamb Café runs. There are no renewals and nothing to cancel. Plus may grow with new things; it will never become a subscription. Plus only adds to games without other real people, so it never gives anyone an advantage over another player.</p>

<h2>Who sells it</h2>
<p>Plus is sold by our reseller Polar (Polar Software, Inc., USA), which is the merchant of record. Polar takes the payment, issues the receipt and handles VAT, and its buyer terms apply to the payment itself. In Europe prices include VAT; elsewhere local tax may be added at checkout.</p>

<h2>Refunds</h2>
<p>If you change your mind, write to us within 7 days of buying and we refund you in full. Plus is digital content that you get at once: by buying it you ask for it to start immediately and accept that the legal 14-day right to withdraw ends at that moment. The 7 days are our own promise on top. If Plus does not work for you later and we cannot fix it, we refund you too. A refund removes Plus and the thank-you pin from the account.</p>

<h2>If the game closes</h2>
<p>If we ever decide to close Yamb Café, we will say so in the game at least 30 days before.</p>

<h2>Liability</h2>
<p>Yamb Café is offered as it is, for fun. As far as the law allows, we are not liable for losses from using it or from it being unavailable. Your rights as a consumer under the law of your country stay as they are.</p>

<h2>Law and disputes</h2>
<p>These terms follow Croatian law. If something goes wrong, please write to us first; we answer within a few days. You can also turn to the consumer protection bodies and courts of your own country.</p>

<h2>Changes</h2>
<p>If these terms change, we update this page and its date. A change never takes away Plus you already bought.</p>`},

hr:{title:'Uvjeti i povrat novca · Yamb Café',h1:'Uvjeti i povrat novca',desc:'Nekoliko pravila za igru Yamb Café, kupnju Yamb Café Plusa i povrat novca.',date:'Yamb Café · 20. studenoga 2026.',back:'Natrag u igru',body:`
<p>Yamb Café je igra s kockama koju je napravio Ivan Kostešić, Hrvatska („mi“ na ovoj stranici). Za sve ovdje piši na <a href="mailto:hello@yambcafe.com">hello@yambcafe.com</a>.</p>

<div class="short">
<strong>Ukratko</strong>
<ul>
<li>Igra je besplatna i možeš je igrati bez računa.</li>
<li>Yamb Café Plus plaća se jednom, nije pretplata. Ostaje uz tvoj račun na svakom uređaju.</li>
<li>Predomislio si se? Javi se u roku od 7 dana i dobivaš sav novac natrag.</li>
</ul>
</div>

<h2>Igra</h2>
<p>Yamb Café se besplatno igra u pregledniku na bilo kojem uređaju. Stalno je poboljšavamo, pa se dijelovi mogu mijenjati. Trudimo se da radi bez prekida, ali to ne možemo obećati.</p>

<h2>Računi</h2>
<p>Prijava nije obavezna i namijenjena je osobama od 16 godina naviše, jedan račun po osobi. Odaberi ime koje drugi smiju vidjeti na ljestvici: ime koje nekoga vrijeđa ili se predstavlja kao netko drugi može se promijeniti ili ukloniti. Isto vrijedi za imena stolova prijatelja. Pozivanje prijatelja nikad ne donosi Plus; može donijeti značku šefa sale, koja u igri ništa drugo ne mijenja. Račun možeš izbrisati u igri kad god želiš. Kako postupamo s podacima, piše na <a href="{{privacy}}">stranici o privatnosti</a>.</p>

<h2>Poštena igra</h2>
<p>Rezultati Dnevnog Jamba provjeravaju se tako da se tvoji potezi odigraju ponovno s kockama tog dana. Rezultati ili računi koji to zaobilaze mogu se ukloniti s ljestvice.</p>

<h2>Yamb Café Plus</h2>
<p>Plus je jednokratna kupnja od 4,99 € naviše. Možeš odlučiti platiti i više; uz svaki iznos veći od 4,99 € dobivaš i malu značku zahvale na profilu, a ništa drugo se time ne otključava. Plus otključava dijelove igre označene kao Plus, kako je opisano u igri, za tvoj račun na svim tvojim uređajima, dok god Yamb Café radi. Nema obnavljanja i nema se što otkazivati. Plus može rasti novim stvarima, ali nikad neće postati pretplata. Plus dodaje samo igrama bez drugih stvarnih ljudi, pa nikome ne daje prednost pred drugim igračem.</p>

<h2>Tko prodaje</h2>
<p>Plus prodaje naš preprodavač Polar (Polar Software, Inc., SAD), koji je trgovac u prodaji. Polar naplaćuje, izdaje račun i obračunava PDV, a na samo plaćanje primjenjuju se njegovi uvjeti za kupce. U Europi cijene uključuju PDV; drugdje se pri plaćanju može dodati lokalni porez.</p>

<h2>Povrat novca</h2>
<p>Ako se predomisliš, javi nam se u roku od 7 dana od kupnje i vraćamo ti cijeli iznos. Plus je digitalni sadržaj koji dobivaš odmah: kupnjom tražiš da isporuka počne odmah i prihvaćaš da zakonsko pravo na odustanak u roku od 14 dana time prestaje. Ovih 7 dana naše je vlastito obećanje povrh toga. Ako ti Plus kasnije ne radi, a mi to ne možemo popraviti, također vraćamo novac. Povrat uklanja Plus i značku zahvale s računa.</p>

<h2>Ako se igra zatvori</h2>
<p>Ako ikad odlučimo zatvoriti Yamb Café, javit ćemo to u igri najmanje 30 dana prije.</p>

<h2>Odgovornost</h2>
<p>Yamb Café nudi se takav kakav jest, za zabavu. Koliko zakon dopušta, ne odgovaramo za štetu zbog korištenja igre ili njezine nedostupnosti. Tvoja potrošačka prava prema zakonu tvoje zemlje ostaju netaknuta.</p>

<h2>Pravo i sporovi</h2>
<p>Na ove uvjete primjenjuje se hrvatsko pravo. Ako nešto pođe po zlu, molimo te da nam se prvo javiš; odgovaramo u nekoliko dana. Možeš se obratiti i tijelima za zaštitu potrošača i sudovima u svojoj zemlji.</p>

<h2>Promjene</h2>
<p>Ako se ovi uvjeti promijene, ažuriramo stranicu i datum. Promjena ti nikad ne oduzima Plus koji si već kupio.</p>`}
}
};
