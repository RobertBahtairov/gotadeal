# gotadeal

Projekti nimi on GotADeal (On Pakkumine)

Eesmärk on teha programm mis web scraper'i abil käib video mängude võtmete edasimüüja lehtetel ja otsib kõige odavamad soodustust.

Shitgrupp on inimised kes tahavad saada oma mänge soodsamast kohast aga ise ei viitsi otsida lehed läbi.

Funktsioonid: *Vaatab sinu avaliku Steam konto wishlist'i,(et teada mis mänge tahat) ning otsib paremaid soodustusi. 
*Näitab hetkeseid soodustusi, ning mis on suuremad soodustused olnud selle jaoks.(nt.praegune soodustus on 25% varem on olnud 30%)
*Võimalus näidata ainuld mingises summa piires (nt. ainuld alla 15€ või vähemald peab olema 30% soodustusega)
*Kaua see soodustus kestab
*Annab nupu mis viib kohe validud soodustuse lehele browseris

Tehnoloogiad mida plaanin kasutada on: JavaScript, Node.js , Axios (hangib HTML koodi), Cheerio (analüüsib HTML'i), Puppeteer (Dünaamiliste lehtede jaoks).

Teostusplaan:
1.Etapp: projekti jaoks vajaliku installimine (Node.js, Axios jne.)
2.Etapp: Kasutaja saab sisestada oma Steam konto ja näeb wishlist mänge ja Steam hinda (Steam'il on API)
3.Etapp: Edasimüüja valik ja uurimine (1.Vähemald 2 poodi 2. kas võin ültse scrape'ida vaatana robots.txt faili 3.äkki saab hinnad läbi poe API ja pole vaja HTML scraperid )
4.Etapp: Mängu nime sobidamine (et leiab õiged mängud nt. sa tahat "@dom"'id aga on teine mäng nimega "adom")
5.Etapp: Hind, soodustus, kestus (võtab lehelt tavahinna, praeguse hinna, soodustuse protsendi ja kaua see kestab)
6.Etapp: Link (mis viib otse lehele)
7.Etapp: Lisa funktsioonid (filter, ajalugu, valuuta)

Miinimum valmisoleku kriteeriumid: 
1.Näeb sinu Steam Wishlist'i ja mis seal on 
2.Näeb mängu võtmede edasimüüjade lehti
3.Leiab sinu tahtud mängusi edasimüüjade lehelt
4.Annab selle preaguse hinna (ja kaua see kestab)
5.Viis otse minna lehele

Soovitavad lõplikud valmisoleku osad:
1.Näha eelmiseid soodustusi
2.Sorteerimine (nt. ainuld alla 15€)
3.Konverteerida erinevaid valuutasid eurodeks (nt. $14.99 = 13.35€)