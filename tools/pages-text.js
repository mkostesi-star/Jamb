// The words of the privacy and terms pages, in English and Croatian. tools/pages.js turns them into pages.
// {{game}}, {{privacy}}, {{terms}} and {{rules}} become links to those pages in the same language.
module.exports={
privacy:{
en:{title:'Privacy · Yamb Café',h1:'Privacy',desc:'What Yamb Café keeps about you, where, and why.',date:'Yamb Café · updated 16 November 2026',back:'Back to the game',body:`
<p>Yamb Café is a dice game made by Ivan Kostešić in Pula, Croatia. This page says what the game keeps about you, where, and why. For questions or requests, write to <a href="mailto:hello@yambcafe.com">hello@yambcafe.com</a>.</p>

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
<li>your finished games: when, which mode and rules, the score, and whether you won;</li>
<li>the records this device had before you first signed in, so they are not lost;</li>
<li>for the Daily Yamb, your moves, so that the server can check your score is possible with that day's dice.</li>
</ul>
<p>Other players see only the name you chose and your Daily Yamb scores on the high scores. Your email address is never shown.</p>
<p>We use this to run the game you signed in for. The legal basis is providing the service you asked for (Article 6(1)(b) of the GDPR).</p>

<h2>Games on several devices</h2>
<p>Devices in a game connect to each other directly, and the moves pass between them. To find each other they use the free PeerJS server (peerjs.com), which sees the devices' internet addresses while they connect, but not the game.</p>

<h2>Visitor numbers</h2>
<p>To know how many people play and which parts they use, the website counts visits and a few things done in the game:</p>
<ul>
<li>which page was opened, the site you came from (or that you came through a game link), the game's language, and whether it runs installed;</li>
<li>games started and finished in each mode, installing the game, signing in, and looking at or buying Plus.</li>
</ul>
<p>No cookies are set, and nothing is stored on or read from your device for this. To count each visitor only once a day, the counter in our database mixes your internet address and browser name with a random key that changes every day, and keeps only the resulting one-way code. The code cannot be turned back into your address. The next day the codes and the key are deleted, so visits on different days cannot be linked, and only the day's totals stay. The counts are never linked to your account, even when you are signed in.</p>
<p>For signed-in players we also count, from the finished games their accounts already keep, how many play again the following week. Only the totals are looked at.</p>
<p>The legal basis is our legitimate interest in knowing how the game is used, so that we can improve it (Article 6(1)(f) of the GDPR).</p>

<h2>Services the website uses</h2>
<ul>
<li><strong>GitHub Pages</strong> hosts the website. Like any web host, it sees your internet address when you open it.</li>
<li><strong>Google Fonts</strong> provides the lettering and <strong>jsDelivr</strong> provides a small program for games on several devices. Both see your internet address when they send these files.</li>
<li><strong>Supabase</strong> stores accounts, scores and the visitor counts, on servers in Frankfurt, Germany. The game also asks it for the day's high scores, signed in or not, so it sees your internet address.</li>
<li><strong>Google</strong> handles the sign-in itself, under <a href="https://policies.google.com/privacy" rel="noopener">Google's privacy policy</a>.</li>
</ul>

<h2>Payments</h2>
<p>There is nothing to buy yet. Yamb Café Plus and tips go on sale with the public start. They will be sold by Polar (Polar Software, Inc., USA) as the merchant of record, which takes the payment, issues the receipt and handles VAT under its own privacy policy. We never see your card. Before the first sale this page will say exactly what we receive from Polar.</p>

<h2>How long we keep it</h2>
<p>Account data is kept until you delete your account. Deleting it removes your profile, your saved games and your scores at once. Visitor codes are deleted the next day; the daily totals are kept. What is stored on your device stays there until you clear it.</p>

<h2>Your rights</h2>
<p>You can ask for a copy of your data, ask us to correct or delete it, or object to how it is used, by writing to <a href="mailto:hello@yambcafe.com">hello@yambcafe.com</a>. You can also delete your account yourself in the game: Settings, Account, Delete my account. If you think your data is handled wrongly, you can complain to the Croatian data protection agency, <a href="https://azop.hr" rel="noopener">AZOP</a>, or to the agency in your own country.</p>

<h2>Children</h2>
<p>Signing in is for people aged 16 and over. Anyone can play without an account.</p>

<h2>Changes</h2>
<p>If anything here changes, we update this page and the date at the top. The <a href="{{terms}}">terms and refunds</a> are on their own page.</p>`},

hr:{title:'Privatnost · Yamb Café',h1:'Privatnost',desc:'Što Yamb Café čuva o tebi, gdje i zašto.',date:'Yamb Café · ažurirano 16. studenoga 2026.',back:'Natrag u igru',body:`
<p>Yamb Café je igra s kockama koju je napravio Ivan Kostešić iz Pule. Ova stranica govori što igra čuva o tebi, gdje i zašto. Za pitanja i zahtjeve piši na <a href="mailto:hello@yambcafe.com">hello@yambcafe.com</a>.</p>

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
<li>tvoje završene igre: kada, koji način i pravila, rezultat i jesi li pobijedio;</li>
<li>rekorde koje je ovaj uređaj imao prije prve prijave, da se ne izgube;</li>
<li>za Dnevni Jamb tvoje poteze, da poslužitelj provjeri je li rezultat moguć s kockama tog dana.</li>
</ul>
<p>Drugi igrači vide samo ime koje si odabrao i tvoje rezultate Dnevnog Jamba na ljestvici. Tvoja adresa e-pošte nikad se ne prikazuje.</p>
<p>To koristimo za igru za koju si se prijavio. Pravna osnova je pružanje usluge koju si zatražio (članak 6. stavak 1. točka (b) GDPR-a).</p>

<h2>Igre na više uređaja</h2>
<p>Uređaji u igri povezuju se izravno, a potezi idu između njih. Da se pronađu, koriste besplatni poslužitelj PeerJS (peerjs.com), koji vidi internetske adrese uređaja dok se povezuju, ali ne i igru.</p>

<h2>Broj posjetitelja</h2>
<p>Da znamo koliko ljudi igra i koje dijelove koriste, stranica broji posjete i nekoliko radnji u igri:</p>
<ul>
<li>koja je stranica otvorena, s koje si stranice došao (ili da si došao preko poveznice na igru), jezik igre i radi li igra instalirana;</li>
<li>započete i završene igre u svakom načinu, instaliranje igre, prijavu te pregled ili kupnju Plusa.</li>
</ul>
<p>Za to se ne postavljaju kolačići i ništa se ne sprema na tvoj uređaj niti čita s njega. Da se svaki posjetitelj broji samo jednom dnevno, brojač u našoj bazi miješa tvoju internetsku adresu i naziv preglednika sa slučajnim ključem koji se mijenja svaki dan i čuva samo dobiveni jednosmjerni kod. Iz koda se tvoja adresa ne može vratiti. Sutradan se kodovi i ključ brišu, pa se posjeti iz različitih dana ne mogu povezati, a ostaju samo dnevni zbrojevi. Brojke se nikad ne povezuju s tvojim računom, ni kad si prijavljen.</p>
<p>Za prijavljene igrače iz završenih igara koje njihovi računi već čuvaju brojimo i koliko ih igra ponovno sljedećeg tjedna. Gledaju se samo zbrojevi.</p>
<p>Pravna osnova je naš legitimni interes da znamo kako se igra koristi, kako bismo je poboljšali (članak 6. stavak 1. točka (f) GDPR-a).</p>

<h2>Usluge koje stranica koristi</h2>
<ul>
<li><strong>GitHub Pages</strong> poslužuje stranicu. Kao svaki web poslužitelj, vidi tvoju internetsku adresu kad je otvoriš.</li>
<li><strong>Google Fonts</strong> daje slova, a <strong>jsDelivr</strong> mali program za igre na više uređaja. Oba vide tvoju internetsku adresu kad šalju te datoteke.</li>
<li><strong>Supabase</strong> čuva račune, rezultate i broj posjetitelja na poslužiteljima u Frankfurtu, u Njemačkoj. Igra ga pita i za dnevnu ljestvicu, bio ti prijavljen ili ne, pa vidi tvoju internetsku adresu.</li>
<li><strong>Google</strong> obavlja samu prijavu, prema <a href="https://policies.google.com/privacy?hl=hr" rel="noopener">Googleovim pravilima o privatnosti</a>.</li>
</ul>

<h2>Plaćanja</h2>
<p>Zasad se ništa ne prodaje. Yamb Café Plus i napojnice u prodaji su od javnog početka. Prodavat će ih Polar (Polar Software, Inc., SAD) kao trgovac, koji naplaćuje, izdaje račun i obračunava PDV prema svojim pravilima o privatnosti. Tvoju karticu nikad ne vidimo. Prije prve prodaje ova će stranica točno navesti što od Polara dobivamo.</p>

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
en:{title:'Terms and refunds · Yamb Café',h1:'Terms and refunds',desc:'The few rules for playing Yamb Café, buying Yamb Café Plus, and getting your money back.',date:'Yamb Café · 16 November 2026',back:'Back to the game',body:`
<p>Yamb Café is a dice game made by Ivan Kostešić, a private person in Pula, Croatia (“we” on this page). For anything here, write to <a href="mailto:hello@yambcafe.com">hello@yambcafe.com</a>.</p>

<div class="short">
<strong>In short</strong>
<ul>
<li>The game is free, and you can play without an account.</li>
<li>Yamb Café Plus is one payment, not a subscription. It stays with your account on every device.</li>
<li>Changed your mind? Write within 14 days and you get all your money back.</li>
</ul>
</div>

<h2>The game</h2>
<p>Yamb Café is free to play in the browser on any device. We keep improving it, so parts of it may change. We do our best to keep it running, but cannot promise it is never interrupted.</p>

<h2>Accounts</h2>
<p>Signing in is optional and is for people aged 16 and over, one person per account. Choose a name others may see on the high scores: a name that insults someone or pretends to be someone else may be changed or removed. You can delete your account at any time in the game. How we handle your data is on the <a href="{{privacy}}">privacy page</a>.</p>

<h2>Fair play</h2>
<p>Daily Yamb scores are checked by playing your moves again with that day's dice. Scores or accounts that get around this may be removed from the high scores.</p>

<h2>Yamb Café Plus</h2>
<p>Plus is a one-time purchase, from €4.99. You may choose to pay more. It unlocks the Plus parts of the game, as described in the game, for your account on all your devices, for as long as Yamb Café runs. There are no renewals and nothing to cancel. Plus may grow with new things; it will never become a subscription. Plus only adds to games without other real people, so it never gives anyone an advantage over another player.</p>

<h2>Tips</h2>
<p>A tip, “A coffee for the café”, is a voluntary thank-you of any amount from €3. It unlocks nothing beyond a small thank-you mark on your profile.</p>

<h2>Who sells it</h2>
<p>Plus and tips are sold by our reseller Polar (Polar Software, Inc., USA), which is the merchant of record. Polar takes the payment, issues the receipt and handles VAT, and its buyer terms apply to the payment itself. Prices include VAT.</p>

<h2>Refunds</h2>
<p>If you change your mind, write to us within 14 days of buying and we refund you in full, no questions asked. By law, the right to withdraw from digital content that starts at once can end when you start using it; we give you the 14 days anyway. If Plus does not work for you later and we cannot fix it, we refund you too. A tip given by mistake is refunded within 14 days. A refunded purchase removes Plus or the thank-you mark from the account.</p>

<h2>If the game closes</h2>
<p>If we ever decide to close Yamb Café, we will say so in the game at least 30 days before.</p>

<h2>Liability</h2>
<p>Yamb Café is offered as it is, for fun. As far as the law allows, we are not liable for losses from using it or from it being unavailable. Your rights as a consumer under the law of your country stay as they are.</p>

<h2>Law and disputes</h2>
<p>These terms follow Croatian law. If something goes wrong, please write to us first; we answer within a few days. You can also turn to the consumer protection bodies and courts of your own country.</p>

<h2>Changes</h2>
<p>If these terms change, we update this page and its date. A change never takes away Plus you already bought.</p>`},

hr:{title:'Uvjeti i povrat novca · Yamb Café',h1:'Uvjeti i povrat novca',desc:'Nekoliko pravila za igru Yamb Café, kupnju Yamb Café Plusa i povrat novca.',date:'Yamb Café · 16. studenoga 2026.',back:'Natrag u igru',body:`
<p>Yamb Café je igra s kockama koju je napravio Ivan Kostešić, privatna osoba iz Pule („mi“ na ovoj stranici). Za sve ovdje piši na <a href="mailto:hello@yambcafe.com">hello@yambcafe.com</a>.</p>

<div class="short">
<strong>Ukratko</strong>
<ul>
<li>Igra je besplatna i možeš je igrati bez računa.</li>
<li>Yamb Café Plus plaća se jednom, nije pretplata. Ostaje uz tvoj račun na svakom uređaju.</li>
<li>Predomislio si se? Javi se u roku od 14 dana i dobivaš sav novac natrag.</li>
</ul>
</div>

<h2>Igra</h2>
<p>Yamb Café se besplatno igra u pregledniku na bilo kojem uređaju. Stalno je poboljšavamo, pa se dijelovi mogu mijenjati. Trudimo se da radi bez prekida, ali to ne možemo obećati.</p>

<h2>Računi</h2>
<p>Prijava nije obavezna i namijenjena je osobama od 16 godina naviše, jedan račun po osobi. Odaberi ime koje drugi smiju vidjeti na ljestvici: ime koje nekoga vrijeđa ili se predstavlja kao netko drugi može se promijeniti ili ukloniti. Račun možeš izbrisati u igri kad god želiš. Kako postupamo s podacima, piše na <a href="{{privacy}}">stranici o privatnosti</a>.</p>

<h2>Poštena igra</h2>
<p>Rezultati Dnevnog Jamba provjeravaju se tako da se tvoji potezi odigraju ponovno s kockama tog dana. Rezultati ili računi koji to zaobilaze mogu se ukloniti s ljestvice.</p>

<h2>Yamb Café Plus</h2>
<p>Plus je jednokratna kupnja, od 4,99 €. Možeš odlučiti platiti i više. Otključava dijelove igre označene kao Plus, kako je opisano u igri, za tvoj račun na svim tvojim uređajima, dok god Yamb Café radi. Nema obnavljanja i nema se što otkazivati. Plus može rasti novim stvarima, ali nikad neće postati pretplata. Plus dodaje samo igrama bez drugih stvarnih ljudi, pa nikome ne daje prednost pred drugim igračem.</p>

<h2>Napojnice</h2>
<p>Napojnica, „Kava za kafić“, dobrovoljna je zahvala u bilo kojem iznosu od 3 €. Ne otključava ništa osim male oznake zahvale na tvom profilu.</p>

<h2>Tko prodaje</h2>
<p>Plus i napojnice prodaje naš preprodavač Polar (Polar Software, Inc., SAD), koji je trgovac u prodaji. Polar naplaćuje, izdaje račun i obračunava PDV, a na samo plaćanje primjenjuju se njegovi uvjeti za kupce. Cijene uključuju PDV.</p>

<h2>Povrat novca</h2>
<p>Ako se predomisliš, javi nam se u roku od 14 dana od kupnje i vraćamo ti cijeli iznos, bez pitanja. Po zakonu pravo na odustanak od digitalnog sadržaja koji počinje odmah može prestati kad ga počneš koristiti; mi ti svejedno dajemo 14 dana. Ako ti Plus kasnije ne radi, a mi to ne možemo popraviti, također vraćamo novac. Napojnica dana greškom vraća se u roku od 14 dana. Vraćena kupnja uklanja Plus ili oznaku zahvale s računa.</p>

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
