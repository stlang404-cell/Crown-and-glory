# Federation persona roster (crown-roster-1 and crown-roster-pub-1)

Owner request, v0.10 Decision 2 as revised after the owner's explicit instruction (docs/V10_PLAN.md). Part of the
Federation's population carries the names of real people as **clearly fictional chess personas**, in two sets:

* the **historical set** (`hist-…`, crown-roster-1): figures who died in 1925 or earlier;
* the **contemporary set** (`pub-…`, crown-roster-pub-1): widely known adult public figures who are living or died
  after 1925 — musicians, singers, actors, heads of state and government, politicians, scientists, inventors,
  athletes, artists, authors, philosophers, explorers and chess players — included because the owner explicitly asked
  for them (twice), naming e.g. Taylor Swift, Beyoncé, Drake, Michael Jackson, Barack Obama, Donald Trump, Leonardo
  DiCaprio, Tom Cruise, Morgan Freeman, Albert Einstein, Marie Curie, Michael Jordan, LeBron James and Serena Williams.

This file is the policy, the safeguards, the exclusion list and the provenance record for every identity. Data:
`src/federation/rosterIdentities.json` (historical), `src/federation/rosterContemporary.json` (contemporary). Logic:
`src/federation/rosterPersonas.ts`. Display switch: `src/app/namePrefs.ts`. Tests: `tests/roster.test.ts`.

## Policy

* **Historical inclusion rule.** Historical figures who **died in 1925 or earlier** (more than 100 years before 2026).
* **Contemporary inclusion rule.** Adult, widely known public figures, known for their public work, who are living or
  died after 1925; accurately spelled, with their English Wikipedia article title as reference, spread across every
  region of the world and, for leaders, across many countries and parties (no selection by viewpoint).
* **Fictional personas.** A persona is a name laid over a competitor the population generator has already made.
  Rating, hidden strength, playing style, Federation region, division, age, career, titles and results come from the
  seeded generator and the simulation. They are assigned **independently of the person** (by seeded hashes of the world
  seed and competitor id), never by fame, nationality, politics or any other trait, and say nothing about the real
  person: a famous politician or athlete can be rated 300 or 3,000 by chance. Tests check this (the attributes of a
  persona competitor are exactly those of the plain generation; personas spread over every division and region; their
  mean rating is the population's).
* **Names only, no personal data.** A contemporary entry holds only what identifies the public figure: id, display
  name, category, real-world region, a neutral one-line profession descriptor ("American singer-songwriter", "44th
  President of the United States"), the Wikipedia reference and a `living` flag (as of compilation). No birth dates,
  no claims about anyone's views, private life, health or controversies.
* **No likenesses.** No photographs, paintings, likenesses, signatures, logos or official branding. Personas use the
  same original, procedurally generated pixel portraits and heraldic insignias as every other competitor.
* **Federation region is not the person's homeland.** The Federation's regions (Ashmere, Brightwater, …) are
  invented. The `region` field records the person's real-world region, for provenance and to keep the roster global;
  it is not used to place the persona.
* **Accuracy before count.** An identity is included only when its name and reference are well established; entries
  we were not sure about are listed below as left out.

## Safeguards for the contemporary set

* **Disclosure on every persona surface.** *"Fictional chess persona — not the real person; no participation or
  endorsement."* appears on the competitor profile, in the roster browser (Discover Competitors: note above the list
  and on each Persona chip), on the spectator / Match Center player bars (Persona chip and a line under the board) and
  on the player's own game screen against a Federation persona ("Fictional Persona" chip). Profiles add *"Rating,
  style, region, division and career are assigned by the world seed, independently of the person."*
* **Settings → Federation Names → "Show contemporary famous names"** (default **on**, as the owner asked). When it is
  off, every contemporary persona is shown under its **stable original fictional name**: the competitor's own
  generated name, kept as `altName` when the persona was assigned. Ids, ratings, results, titles and history never
  change; turning the switch on again restores the famous name. Generated names are reserved independently of the
  switch, so it can never change what the simulation produces. Historical personas are not affected. The setting is
  remembered in this browser only.
* **Exclusions** (below): minors, private individuals, people known primarily for atrocities, terrorism or violent
  crime, people subject to an international criminal arrest warrant, religious figures of worship and clergy known
  as such, and anyone whose fame is primarily scandal.
* **Residual risk.** The game is free and non-commercial, but the GitHub Pages site is **public**: anyone can open it
  and see these names. Rights of publicity differ by jurisdiction, and a living person could object to the use of
  their name even as a clearly fictional persona.
* **Removal procedure.** If any person or their representative objects, or a reviewer finds an entry inaccurate:
  delete the entry from `src/federation/rosterContemporary.json`, add the name to the exclusion list in
  `tests/roster.test.ts`, run `npx tsx tools/roster/gen-doc.mts` and the tests, and publish. Existing worlds need no
  migration: a competitor whose identity is no longer in the data keeps its id, record and history and is shown under
  its original name (`altName`) on every device, whatever the setting. (Text already written into older career
  milestones and the player's own saved game records keeps the name it was written with until those records are
  replaced.) The id is never reused.

## How personas enter a Federation

* **Existing federations keep every competitor's name and id.** Nothing already stored is renamed, and loading an
  older save never adds a persona to an existing competitor.
* **New federations (2,048 competitors):** when a federation is founded, **8% carry a historical persona (164)** and
  **6% carry a contemporary persona (123)**, on different competitors: 287 personas (14%), the rest original names.
  Each share is capped at 60% of its set (245 historical, 210 contemporary) so that later entrants can still bring new
  identities.
* **Owner-named people first.** Within each set the world's seeded hand-out order puts the people the owner named
  first (contemporary: Taylor Swift, Beyoncé, Drake, Michael Jackson, Barack Obama, Donald Trump, Leonardo DiCaprio,
  Tom Cruise, Morgan Freeman, Albert Einstein, Marie Curie, Michael Jordan, LeBron James, Serena Williams; historical:
  Abraham Lincoln, Napoleon Bonaparte, Isaac Newton, Leonardo da Vinci, Vincent van Gogh, Julius Caesar), so every new
  federation carries all of them — still on seeded-random competitors, and so at seeded-random ratings, styles and
  divisions. Everyone else follows in seeded order.
* **Turnover (every federation, old and new):** each new entrant that replaces a retirement at a season's end has a
  12% seeded chance of carrying the next unused historical identity and a separate 8% chance of carrying the next
  unused contemporary identity. Identities are never reused within a world, even after their competitor retires.
  Older (v0.9) worlds therefore meet the owner-named contemporary people first among their entrants.
* Everything is deterministic for a world seed. Each competitor record holds `persona: <identity id>` (and, for a
  contemporary persona, `altName`); the UI uses it to show the persona label, descriptor and disclosure.

## Not used, and why

| Who | Reason | Original alternative |
|---|---|---|
| Minors (anyone under 18 at compilation), e.g. child performers and junior athletes; and Anne Frank | Minors are never included; Anne Frank is remembered as a child victim | — |
| Private individuals, and people known only pseudonymously (e.g. Banksy, Satoshi Nakamoto, Elena Ferrante) | Not public figures, or their identity is deliberately private | — |
| Figures known primarily for atrocities, terrorism or violent crime, e.g. Adolf Hitler, Joseph Stalin, Mao Zedong, Pol Pot, Kim Jong Un, Saddam Hussein, Idi Amin, Muammar Gaddafi, Osama bin Laden; earlier, Genghis Khan, Timur, Attila, Vlad the Impaler, Ivan the Terrible, Caligula, Nero, Leopold II of Belgium, Ranavalona I, Christopher Columbus, Hernán Cortés, Francisco Pizarro, Vasco da Gama, Henry Morton Stanley, Cecil Rhodes, Andrew Jackson | Known primarily for mass killing, terror, conquest or colonial brutality | — |
| Current or former leaders subject to an International Criminal Court arrest warrant or such proceedings, e.g. Vladimir Putin, Benjamin Netanyahu, Rodrigo Duterte, Omar al-Bashir | A neutral, objective rule applied to every country alike | Other heads of state and government of the same countries' histories (e.g. Mikhail Gorbachev, Golda Meir, Yitzhak Rabin, Menachem Begin, Corazon Aquino) |
| People convicted of violent or sexual crimes, or of attempting a coup, e.g. Mike Tyson, Floyd Mayweather, Gérard Depardieu, Jair Bolsonaro; and people whose public profile is dominated by such allegations, e.g. Conor McGregor, Neil Gaiman | "Violent crime" exclusion | — |
| People whose fame is primarily scandal or celebrity of controversy, e.g. Kim Kardashian, Paris Hilton | "Primarily scandal" exclusion | — |
| Religious founders, leaders and figures of worship, e.g. Jesus, Muhammad, Gautama Buddha, Moses, Zoroaster, Confucius, Laozi, Guru Nanak, Martin Luther, Pythagoras; contemporary: Pope Francis, the Dalai Lama, Mother Teresa, Desmond Tutu, Haile Selassie (venerated in the Rastafari movement), B. R. Ambedkar (founder of the Navayana Buddhist movement), Ruhollah Khomeini, Japanese emperors (Emperor Meiji, Akihito); saints and venerated figures, e.g. Joan of Arc, Francis of Assisi, Hildegard of Bingen, Thomas Aquinas, Mary MacKillop, Rumi, Kabir; rulers worshipped or enshrined as divine, e.g. Chulalongkorn, Augustus; founders of religious movements, e.g. Akbar (Din-i Ilahi), Auguste Comte (Religion of Humanity), Ram Mohan Roy; clergy known as such, e.g. Miguel Hidalgo, Sor Juana Inés de la Cruz | Religious founders, objects of worship or veneration, clergy | — |
| Serious crimes or contested legacies in the historical set, e.g. Juan Luna and Max Linder (killed their wives), Caravaggio (killed a man), Paul Gauguin, Egon Schiele, Richard Wagner, P. T. Barnum, Cap Anson, Ned Kelly, Mata Hari, Jean-Jacques Dessalines, Tipu Sultan | Left out conservatively; a chess persona should not invite controversy about the person | — |
| Alexander the Great | Conqueror whose fame rests on wars of conquest; left out conservatively (Julius Caesar and Napoleon Bonaparte, also conquerors, are included because the owner named them explicitly) | — |
| People remembered mainly for suffering or martyrdom, e.g. Truganini, Yu Gwan-sun, Sacagawea, General Tom Thumb | Left out out of respect | — |
| People whose name is itself a commercial brand, e.g. Walt Disney, Soichiro Honda, Enzo Ferrari, Coco Chanel, Henry Ford | "No logos or official branding" | — |

Between the two sets, people who died between 1926 and the present (e.g. Albert Einstein, Marie Curie, Claude
Monet, Thomas Edison, Nikola Tesla, Mahatma Gandhi, Winston Churchill) are in the contemporary set or left out by
the rules above; they are no longer excluded for their date of death.

### Considered and left out because a fact could not be confirmed with confidence

Historical set: Gioachino Greco, Ruy López de Segura and Pedro Damiano (uncertain lifespans), Euclid, Homer, Sappho,
Aesop, Hypatia, Murasaki Shikibu and Sei Shōnagon (uncertain or legendary lifespans), Pierre de Fermat (disputed birth
year), Florentino Ameghino (birth year given as 1853 or 1854), Alexander Hamilton (disputed birth year), Hatshepsut,
Ashoka, Mansa Musa, Nzinga of Ndongo and Matamba, Kamehameha I, Lakshmibai (Rani of Jhansi, disputed birth year),
Tyagaraja and Muthuswami Dikshitar (venerated as saints), Antonio Maceo, Rachel Félix, Mademoiselle Mars, Vernon
Castle, the Montgolfier brothers, Francis Bacon (shares a name with a 20th-century painter) and Bai Bureh, Almeida
Júnior (reference titles not certain).

Contemporary set:
* **Living status could not be confirmed for the data date** (very old, or reported deaths we could not verify):
  David Attenborough, Noam Chomsky, Jürgen Habermas, Wole Soyinka, Clint Eastwood, Sophia Loren, Judi Dench, Michael
  Caine, Buzz Aldrin, Mahathir Mohamad, Fernando Henrique Cardoso, Amartya Sen, Tu Youyou, Yang Chen-Ning, Fairuz,
  Asha Bhosle, John Williams, Yayoi Kusama, Thomas Sowell, Sylvia Earle, Dolores Huerta, Frank Gehry, Giorgio Armani,
  James Watson, Alasdair MacIntyre, Paulin Hountondji, Martin Cooper.
* **Reference title or spelling not certain:** Psy, Sia, Khaled, Tarkan, Dimash Kudaibergen, Chinghiz Aitmatov, Ash
  Barty, Norman Foster, Allan Cormack, Jügderdemidiin Gürragchaa, Andy Thomas.
* **Contested or controversy-dominated public profile, left out conservatively:** Kanye West, Johnny Depp, Will
  Smith, Roald Dahl, Hergé, Le Corbusier, Guglielmo Marconi, Wernher von Braun, Charles Lindbergh, Alexander Alekhine,
  Martin Heidegger, Richard Nixon, Henry Kissinger, Fidel Castro, Che Guevara, Yasser Arafat, Deng Xiaoping, Ho Chi
  Minh, Sukarno, Aung San Suu Kyi, Sheikh Hasina, Nayib Bukele, Abiy Ahmed, Paul Kagame, Alice Munro, Yukio Mishima,
  M. F. Husain, Malcolm X, Russell Crowe, Salman Khan, Fan Bingbing, PewDiePie.
* **Trimmed to keep the set near 350 and the regions balanced:** many further well-known people (e.g. Johnny Cash,
  Ella Fitzgerald, Harrison Ford, Helen Mirren, Niels Bohr, Max Planck, Thor Heyerdahl). This is no judgement on
  them; they can be added later with the same checks.

## Historical roster


<!-- roster:generated:begin -->

**409 identities.** Generated from `src/federation/rosterIdentities.json` by `npx tsx tools/roster/gen-doc.mts`; do not edit by hand. Owner-named people are marked ★.

| Category | Identities |
|---|---:|
| Leaders & Statespeople | 54 |
| Musicians & Composers | 34 |
| Actors & Performers | 20 |
| Artists & Architects | 45 |
| Scientists & Mathematicians | 49 |
| Inventors & Engineers | 20 |
| Authors & Poets | 67 |
| Philosophers & Thinkers | 28 |
| Explorers & Travellers | 20 |
| Athletes | 25 |
| Chess Masters | 18 |
| Reformers & Other Cultural Figures | 29 |

| Region | Identities |
|---|---:|
| Europe | 173 |
| North America | 68 |
| Latin America & Caribbean | 34 |
| Sub-Saharan Africa | 12 |
| Middle East & North Africa | 17 |
| Central Asia | 5 |
| South Asia | 24 |
| East Asia | 48 |
| Southeast Asia | 12 |
| Oceania | 16 |

### Provenance

| Id | Name | Lifespan | Category | Region | Descriptor | Reference (English Wikipedia title) |
|---|---|---|---|---|---|---|
| `hist-julius-caesar` | Julius Caesar ★ | c. 100 BC – 44 BC | Leaders & Statespeople | Europe | Roman general and statesman | Julius Caesar |
| `hist-cleopatra` | Cleopatra | 69 BC – 30 BC | Leaders & Statespeople | Middle East & North Africa | Last active ruler of Ptolemaic Egypt | Cleopatra |
| `hist-sejong-the-great` | Sejong the Great | 1397–1450 | Leaders & Statespeople | East Asia | King of Joseon who promulgated the Hangul script | Sejong the Great |
| `hist-elizabeth-i` | Elizabeth I | 1533–1603 | Leaders & Statespeople | Europe | Queen of England and Ireland | Elizabeth I |
| `hist-gabriela-silang` | Gabriela Silang | 1731–1763 | Leaders & Statespeople | Southeast Asia | Filipino revolt leader in Ilocos | Gabriela Silang |
| `hist-george-washington` | George Washington | 1732–1799 | Leaders & Statespeople | North America | First President of the United States | George Washington |
| `hist-thomas-jefferson` | Thomas Jefferson | 1743–1826 | Leaders & Statespeople | North America | Principal author of the US Declaration of Independence | Thomas Jefferson |
| `hist-toussaint-louverture` | Toussaint Louverture | 1743–1803 | Leaders & Statespeople | Latin America & Caribbean | Leader of the Haitian Revolution | Toussaint Louverture |
| `hist-tadeusz-kosciuszko` | Tadeusz Kościuszko | 1746–1817 | Leaders & Statespeople | Europe | Polish-Lithuanian military engineer and national leader | Tadeusz Kościuszko |
| `hist-william-wilberforce` | William Wilberforce | 1759–1833 | Leaders & Statespeople | Europe | British parliamentarian against the slave trade | William Wilberforce |
| `hist-tecumseh` | Tecumseh | 1768–1813 | Leaders & Statespeople | North America | Shawnee leader of a Native American confederacy | Tecumseh |
| `hist-napoleon-bonaparte` | Napoleon Bonaparte ★ | 1769–1821 | Leaders & Statespeople | Europe | French military leader and Emperor of the French | Napoleon |
| `hist-laura-secord` | Laura Secord | 1775–1868 | Leaders & Statespeople | North America | Canadian heroine of the War of 1812 | Laura Secord |
| `hist-bernardo-ohiggins` | Bernardo O'Higgins | 1778–1842 | Leaders & Statespeople | Latin America & Caribbean | Chilean independence leader | Bernardo O'Higgins |
| `hist-jose-de-san-martin` | José de San Martín | 1778–1850 | Leaders & Statespeople | Latin America & Caribbean | Argentine general of South American independence | José de San Martín |
| `hist-ranjit-singh` | Ranjit Singh | 1780–1839 | Leaders & Statespeople | South Asia | Founder of the Sikh Empire | Ranjit Singh |
| `hist-simon-bolivar` | Simón Bolívar | 1783–1830 | Leaders & Statespeople | Latin America & Caribbean | Leader of South American independence | Simón Bolívar |
| `hist-diponegoro` | Diponegoro | 1785–1855 | Leaders & Statespeople | Southeast Asia | Javanese prince who led the Java War | Diponegoro |
| `hist-lin-zexu` | Lin Zexu | 1785–1850 | Leaders & Statespeople | East Asia | Qing dynasty official and scholar | Lin Zexu |
| `hist-moshoeshoe-i` | Moshoeshoe I | c. 1786–1870 | Leaders & Statespeople | Sub-Saharan Africa | Founder of the Basotho nation | Moshoeshoe I |
| `hist-antonio-jose-de-sucre` | Antonio José de Sucre | 1795–1830 | Leaders & Statespeople | Latin America & Caribbean | Venezuelan independence leader and Bolivian president | Antonio José de Sucre |
| `hist-manuela-saenz` | Manuela Sáenz | 1797–1856 | Leaders & Statespeople | Latin America & Caribbean | Ecuadorian revolutionary of South American independence | Manuela Sáenz |
| `hist-benito-juarez` | Benito Juárez | 1806–1872 | Leaders & Statespeople | Latin America & Caribbean | President of Mexico and liberal reformer | Benito Juárez |
| `hist-amir-kabir` | Amir Kabir | 1807–1852 | Leaders & Statespeople | Middle East & North Africa | Chief minister and reformer of Qajar Iran | Amir Kabir |
| `hist-giuseppe-garibaldi` | Giuseppe Garibaldi | 1807–1882 | Leaders & Statespeople | Europe | Italian unification leader | Giuseppe Garibaldi |
| `hist-abraham-lincoln` | Abraham Lincoln ★ | 1809–1865 | Leaders & Statespeople | North America | 16th President of the United States | Abraham Lincoln |
| `hist-joseph-jenkins-roberts` | Joseph Jenkins Roberts | 1809–1876 | Leaders & Statespeople | Sub-Saharan Africa | First President of Liberia | Joseph Jenkins Roberts |
| `hist-domingo-faustino-sarmiento` | Domingo Faustino Sarmiento | 1811–1888 | Leaders & Statespeople | Latin America & Caribbean | Argentine president, writer and educator | Domingo Faustino Sarmiento |
| `hist-melchora-aquino` | Melchora Aquino | 1812–1919 | Leaders & Statespeople | Southeast Asia | Filipino revolutionary known as Tandang Sora | Melchora Aquino |
| `hist-henry-parkes` | Henry Parkes | 1815–1896 | Leaders & Statespeople | Oceania | Premier of New South Wales and advocate of federation | Henry Parkes |
| `hist-otto-von-bismarck` | Otto von Bismarck | 1815–1898 | Leaders & Statespeople | Europe | First Chancellor of the German Empire | Otto von Bismarck |
| `hist-queen-victoria` | Queen Victoria | 1819–1901 | Leaders & Statespeople | Europe | Queen of the United Kingdom | Queen Victoria |
| `hist-begum-hazrat-mahal` | Begum Hazrat Mahal | c. 1820–1879 | Leaders & Statespeople | South Asia | Regent of Awadh during the 1857 uprising | Begum Hazrat Mahal |
| `hist-red-cloud` | Red Cloud | 1822–1909 | Leaders & Statespeople | North America | Oglala Lakota leader | Red Cloud |
| `hist-katsu-kaishu` | Katsu Kaishū | 1823–1899 | Leaders & Statespeople | East Asia | Japanese naval statesman | Katsu Kaishū |
| `hist-dadabhai-naoroji` | Dadabhai Naoroji | 1825–1917 | Leaders & Statespeople | South Asia | Indian political leader and economist | Dadabhai Naoroji |
| `hist-pedro-ii-of-brazil` | Pedro II of Brazil | 1825–1891 | Leaders & Statespeople | Latin America & Caribbean | Second and last Emperor of Brazil | Pedro II of Brazil |
| `hist-cetshwayo` | Cetshwayo | 1826–1884 | Leaders & Statespeople | Sub-Saharan Africa | King of the Zulu Kingdom | Cetshwayo |
| `hist-khama-iii` | Khama III | 1835–1923 | Leaders & Statespeople | Sub-Saharan Africa | Kgosi of the Bamangwato in present-day Botswana | Khama III |
| `hist-sakamoto-ryoma` | Sakamoto Ryōma | 1836–1867 | Leaders & Statespeople | East Asia | Japanese reformer of the late Edo period | Sakamoto Ryōma |
| `hist-liliuokalani` | Liliʻuokalani | 1838–1917 | Leaders & Statespeople | Oceania | Last monarch of the Kingdom of Hawaii | Liliʻuokalani |
| `hist-chief-joseph` | Chief Joseph | 1840–1904 | Leaders & Statespeople | North America | Leader of the Wallowa band of the Nez Perce | Chief Joseph |
| `hist-yaa-asantewaa` | Yaa Asantewaa | c. 1840–1921 | Leaders & Statespeople | Sub-Saharan Africa | Queen mother of Ejisu in the Ashanti Empire | Yaa Asantewaa |
| `hist-menelik-ii` | Menelik II | 1844–1913 | Leaders & Statespeople | Sub-Saharan Africa | Emperor of Ethiopia | Menelik II |
| `hist-richard-seddon` | Richard Seddon | 1845–1906 | Leaders & Statespeople | Oceania | Prime Minister of New Zealand | Richard Seddon |
| `hist-edmund-barton` | Edmund Barton | 1849–1920 | Leaders & Statespeople | Oceania | First Prime Minister of Australia | Edmund Barton |
| `hist-taytu-betul` | Taytu Betul | c. 1851–1918 | Leaders & Statespeople | Sub-Saharan Africa | Empress of Ethiopia | Taytu Betul |
| `hist-jose-marti` | José Martí | 1853–1895 | Leaders & Statespeople | Latin America & Caribbean | Cuban poet and independence leader | José Martí |
| `hist-bal-gangadhar-tilak` | Bal Gangadhar Tilak | 1856–1920 | Leaders & Statespeople | South Asia | Indian nationalist and scholar | Bal Gangadhar Tilak |
| `hist-andres-bonifacio` | Andrés Bonifacio | 1863–1897 | Leaders & Statespeople | Southeast Asia | Filipino revolutionary leader | Andrés Bonifacio |
| `hist-apolinario-mabini` | Apolinario Mabini | 1864–1903 | Leaders & Statespeople | Southeast Asia | Filipino political theorist and first prime minister | Apolinario Mabini |
| `hist-gopal-krishna-gokhale` | Gopal Krishna Gokhale | 1866–1915 | Leaders & Statespeople | South Asia | Indian political leader and social reformer | Gopal Krishna Gokhale |
| `hist-sun-yat-sen` | Sun Yat-sen | 1866–1925 | Leaders & Statespeople | East Asia | Chinese revolutionary and first provisional president of the Republic of China | Sun Yat-sen |
| `hist-kaiulani` | Kaʻiulani | 1875–1899 | Leaders & Statespeople | Oceania | Crown princess of the Kingdom of Hawaii | Kaʻiulani |
| `hist-claudio-monteverdi` | Claudio Monteverdi | 1567–1643 | Musicians & Composers | Europe | Italian composer of early opera | Claudio Monteverdi |
| `hist-barbara-strozzi` | Barbara Strozzi | 1619–1677 | Musicians & Composers | Europe | Italian Baroque singer and composer | Barbara Strozzi |
| `hist-antonio-vivaldi` | Antonio Vivaldi | 1678–1741 | Musicians & Composers | Europe | Italian Baroque composer and violinist | Antonio Vivaldi |
| `hist-george-frideric-handel` | George Frideric Handel | 1685–1759 | Musicians & Composers | Europe | German-British Baroque composer | George Frideric Handel |
| `hist-johann-sebastian-bach` | Johann Sebastian Bach | 1685–1750 | Musicians & Composers | Europe | German Baroque composer | Johann Sebastian Bach |
| `hist-wolfgang-amadeus-mozart` | Wolfgang Amadeus Mozart | 1756–1791 | Musicians & Composers | Europe | Austrian Classical-era composer | Wolfgang Amadeus Mozart |
| `hist-ludwig-van-beethoven` | Ludwig van Beethoven | 1770–1827 | Musicians & Composers | Europe | German composer and pianist | Ludwig van Beethoven |
| `hist-niccolo-paganini` | Niccolò Paganini | 1782–1840 | Musicians & Composers | Europe | Italian violinist and composer | Niccolò Paganini |
| `hist-gioachino-rossini` | Gioachino Rossini | 1792–1868 | Musicians & Composers | Europe | Italian opera composer | Gioachino Rossini |
| `hist-franz-schubert` | Franz Schubert | 1797–1828 | Musicians & Composers | Europe | Austrian composer of songs and symphonies | Franz Schubert |
| `hist-fanny-mendelssohn` | Fanny Mendelssohn | 1805–1847 | Musicians & Composers | Europe | German composer and pianist | Fanny Mendelssohn |
| `hist-felix-mendelssohn` | Felix Mendelssohn | 1809–1847 | Musicians & Composers | Europe | German Romantic composer | Felix Mendelssohn |
| `hist-frederic-chopin` | Frédéric Chopin | 1810–1849 | Musicians & Composers | Europe | Polish composer and pianist | Frédéric Chopin |
| `hist-robert-schumann` | Robert Schumann | 1810–1856 | Musicians & Composers | Europe | German Romantic composer | Robert Schumann |
| `hist-franz-liszt` | Franz Liszt | 1811–1886 | Musicians & Composers | Europe | Hungarian composer and pianist | Franz Liszt |
| `hist-giuseppe-verdi` | Giuseppe Verdi | 1813–1901 | Musicians & Composers | Europe | Italian opera composer | Giuseppe Verdi |
| `hist-clara-schumann` | Clara Schumann | 1819–1896 | Musicians & Composers | Europe | German pianist and composer | Clara Schumann |
| `hist-johann-strauss-ii` | Johann Strauss II | 1825–1899 | Musicians & Composers | Europe | Austrian composer of waltzes | Johann Strauss II |
| `hist-stephen-foster` | Stephen Foster | 1826–1864 | Musicians & Composers | North America | American songwriter | Stephen Foster |
| `hist-louis-moreau-gottschalk` | Louis Moreau Gottschalk | 1829–1869 | Musicians & Composers | North America | American composer and pianist | Louis Moreau Gottschalk |
| `hist-johannes-brahms` | Johannes Brahms | 1833–1897 | Musicians & Composers | Europe | German Romantic composer | Johannes Brahms |
| `hist-carlos-gomes` | Carlos Gomes | 1836–1896 | Musicians & Composers | Latin America & Caribbean | Brazilian opera composer | Antônio Carlos Gomes |
| `hist-pyotr-ilyich-tchaikovsky` | Pyotr Ilyich Tchaikovsky | 1840–1893 | Musicians & Composers | Europe | Russian Romantic composer | Pyotr Ilyich Tchaikovsky |
| `hist-antonin-dvorak` | Antonín Dvořák | 1841–1904 | Musicians & Composers | Europe | Czech composer | Antonín Dvořák |
| `hist-edvard-grieg` | Edvard Grieg | 1843–1907 | Musicians & Composers | Europe | Norwegian composer and pianist | Edvard Grieg |
| `hist-teresa-carreno` | Teresa Carreño | 1853–1917 | Musicians & Composers | Latin America & Caribbean | Venezuelan pianist and composer | Teresa Carreño |
| `hist-giacomo-puccini` | Giacomo Puccini | 1858–1924 | Musicians & Composers | Europe | Italian opera composer | Giacomo Puccini |
| `hist-claude-debussy` | Claude Debussy | 1862–1918 | Musicians & Composers | Europe | French composer | Claude Debussy |
| `hist-erik-satie` | Erik Satie | 1866–1925 | Musicians & Composers | Europe | French composer and pianist | Erik Satie |
| `hist-juventino-rosas` | Juventino Rosas | 1868–1894 | Musicians & Composers | Latin America & Caribbean | Mexican composer of waltzes | Juventino Rosas |
| `hist-scott-joplin` | Scott Joplin | c. 1868–1917 | Musicians & Composers | North America | American ragtime composer | Scott Joplin |
| `hist-rentaro-taki` | Rentarō Taki | 1879–1903 | Musicians & Composers | East Asia | Japanese composer | Rentarō Taki |
| `hist-james-reese-europe` | James Reese Europe | 1880–1919 | Musicians & Composers | North America | American bandleader and composer | James Reese Europe |
| `hist-lili-boulanger` | Lili Boulanger | 1893–1918 | Musicians & Composers | Europe | French composer | Lili Boulanger |
| `hist-nell-gwyn` | Nell Gwyn | 1650–1687 | Actors & Performers | Europe | English Restoration actress | Nell Gwyn |
| `hist-joseph-grimaldi` | Joseph Grimaldi | 1778–1837 | Actors & Performers | Europe | English clown and pantomime performer | Joseph Grimaldi |
| `hist-ira-aldridge` | Ira Aldridge | 1807–1867 | Actors & Performers | Europe | American-born Shakespearean actor on European stages | Ira Aldridge |
| `hist-fanny-elssler` | Fanny Elssler | 1810–1884 | Actors & Performers | Europe | Austrian ballerina | Fanny Elssler |
| `hist-charlotte-cushman` | Charlotte Cushman | 1816–1876 | Actors & Performers | North America | American stage actress | Charlotte Cushman |
| `hist-jenny-lind` | Jenny Lind | 1820–1887 | Actors & Performers | Europe | Swedish opera singer | Jenny Lind |
| `hist-edwin-booth` | Edwin Booth | 1833–1893 | Actors & Performers | North America | American Shakespearean actor | Edwin Booth |
| `hist-adah-isaacs-menken` | Adah Isaacs Menken | 1835–1868 | Actors & Performers | North America | American actress and poet | Adah Isaacs Menken |
| `hist-henry-irving` | Henry Irving | 1838–1905 | Actors & Performers | Europe | English stage actor and manager | Henry Irving |
| `hist-adelina-patti` | Adelina Patti | 1843–1919 | Actors & Performers | Europe | Italian-Spanish operatic soprano | Adelina Patti |
| `hist-sarah-bernhardt` | Sarah Bernhardt | 1844–1923 | Actors & Performers | Europe | French stage actress | Sarah Bernhardt |
| `hist-tan-xinpei` | Tan Xinpei | 1847–1917 | Actors & Performers | East Asia | Chinese Peking opera performer | Tan Xinpei |
| `hist-eleonora-duse` | Eleonora Duse | 1858–1924 | Actors & Performers | Europe | Italian stage actress | Eleonora Duse |
| `hist-dan-leno` | Dan Leno | 1860–1904 | Actors & Performers | Europe | English music hall comedian | Dan Leno |
| `hist-john-bunny` | John Bunny | 1863–1915 | Actors & Performers | North America | American silent film comedian | John Bunny |
| `hist-enrico-caruso` | Enrico Caruso | 1873–1921 | Actors & Performers | Europe | Italian operatic tenor | Enrico Caruso |
| `hist-bert-williams` | Bert Williams | 1874–1922 | Actors & Performers | North America | Bahamian-American vaudeville comedian | Bert Williams |
| `hist-matsui-sumako` | Matsui Sumako | 1886–1919 | Actors & Performers | East Asia | Japanese stage actress and singer | Matsui Sumako |
| `hist-wallace-reid` | Wallace Reid | 1891–1923 | Actors & Performers | North America | American silent film actor | Wallace Reid |
| `hist-olive-thomas` | Olive Thomas | 1894–1920 | Actors & Performers | North America | American silent film actress | Olive Thomas |
| `hist-wang-xizhi` | Wang Xizhi | c. 303–361 | Artists & Architects | East Asia | Chinese calligrapher | Wang Xizhi |
| `hist-araniko` | Araniko | 1245–1306 | Artists & Architects | South Asia | Nepalese artist and architect | Araniko |
| `hist-leonardo-da-vinci` | Leonardo da Vinci ★ | 1452–1519 | Artists & Architects | Europe | Italian Renaissance painter and polymath | Leonardo da Vinci |
| `hist-wen-zhengming` | Wen Zhengming | 1470–1559 | Artists & Architects | East Asia | Chinese Ming dynasty painter and calligrapher | Wen Zhengming |
| `hist-michelangelo` | Michelangelo | 1475–1564 | Artists & Architects | Europe | Italian Renaissance sculptor and painter | Michelangelo |
| `hist-mimar-sinan` | Mimar Sinan | c. 1490–1588 | Artists & Architects | Middle East & North Africa | Ottoman chief architect | Mimar Sinan |
| `hist-shin-saimdang` | Shin Saimdang | 1504–1551 | Artists & Architects | East Asia | Korean painter and calligrapher | Shin Saimdang |
| `hist-artemisia-gentileschi` | Artemisia Gentileschi | c. 1593–1656 | Artists & Architects | Europe | Italian Baroque painter | Artemisia Gentileschi |
| `hist-diego-velazquez` | Diego Velázquez | 1599–1660 | Artists & Architects | Europe | Spanish Baroque painter | Diego Velázquez |
| `hist-rembrandt` | Rembrandt | 1606–1669 | Artists & Architects | Europe | Dutch Golden Age painter | Rembrandt |
| `hist-johannes-vermeer` | Johannes Vermeer | 1632–1675 | Artists & Architects | Europe | Dutch Golden Age painter | Johannes Vermeer |
| `hist-ogata-korin` | Ogata Kōrin | 1658–1716 | Artists & Architects | East Asia | Japanese painter of the Rinpa school | Ogata Kōrin |
| `hist-ito-jakuchu` | Itō Jakuchū | 1716–1800 | Artists & Architects | East Asia | Japanese painter | Itō Jakuchū |
| `hist-aleijadinho` | Aleijadinho | c. 1738–1814 | Artists & Architects | Latin America & Caribbean | Brazilian sculptor and architect | Aleijadinho |
| `hist-kim-hong-do` | Kim Hong-do | c. 1745–1806 | Artists & Architects | East Asia | Korean painter of daily life | Kim Hong-do |
| `hist-francisco-goya` | Francisco Goya | 1746–1828 | Artists & Architects | Europe | Spanish painter and printmaker | Francisco Goya |
| `hist-elisabeth-vigee-le-brun` | Élisabeth Vigée Le Brun | 1755–1842 | Artists & Architects | Europe | French portrait painter | Élisabeth Vigée Le Brun |
| `hist-william-blake` | William Blake | 1757–1827 | Artists & Architects | Europe | English poet and printmaker | William Blake |
| `hist-katsushika-hokusai` | Katsushika Hokusai | c. 1760–1849 | Artists & Architects | East Asia | Japanese ukiyo-e artist | Hokusai |
| `hist-utagawa-hiroshige` | Utagawa Hiroshige | 1797–1858 | Artists & Architects | East Asia | Japanese ukiyo-e landscape artist | Hiroshige |
| `hist-eugene-delacroix` | Eugène Delacroix | 1798–1863 | Artists & Architects | Europe | French Romantic painter | Eugène Delacroix |
| `hist-raden-saleh` | Raden Saleh | c. 1811–1880 | Artists & Architects | Southeast Asia | Javanese Romantic painter | Raden Saleh |
| `hist-julia-margaret-cameron` | Julia Margaret Cameron | 1815–1879 | Artists & Architects | Europe | British portrait photographer | Julia Margaret Cameron |
| `hist-frederick-law-olmsted` | Frederick Law Olmsted | 1822–1903 | Artists & Architects | North America | American landscape architect | Frederick Law Olmsted |
| `hist-rosa-bonheur` | Rosa Bonheur | 1822–1899 | Artists & Architects | Europe | French animal painter | Rosa Bonheur |
| `hist-kawanabe-kyosai` | Kawanabe Kyōsai | 1831–1889 | Artists & Architects | East Asia | Japanese painter and caricaturist | Kawanabe Kyōsai |
| `hist-francisco-oller` | Francisco Oller | 1833–1917 | Artists & Architects | Latin America & Caribbean | Puerto Rican painter | Francisco Oller |
| `hist-edgar-degas` | Edgar Degas | 1834–1917 | Artists & Architects | Europe | French Impressionist painter and sculptor | Edgar Degas |
| `hist-james-mcneill-whistler` | James McNeill Whistler | 1834–1903 | Artists & Architects | North America | American painter | James McNeill Whistler |
| `hist-winslow-homer` | Winslow Homer | 1836–1910 | Artists & Architects | North America | American landscape and marine painter | Winslow Homer |
| `hist-paul-cezanne` | Paul Cézanne | 1839–1906 | Artists & Architects | Europe | French Post-Impressionist painter | Paul Cézanne |
| `hist-auguste-rodin` | Auguste Rodin | 1840–1917 | Artists & Architects | Europe | French sculptor | Auguste Rodin |
| `hist-ren-bonian` | Ren Bonian | 1840–1896 | Artists & Architects | East Asia | Chinese painter of the Shanghai School | Ren Bonian |
| `hist-berthe-morisot` | Berthe Morisot | 1841–1895 | Artists & Architects | Europe | French Impressionist painter | Berthe Morisot |
| `hist-pierre-auguste-renoir` | Pierre-Auguste Renoir | 1841–1919 | Artists & Architects | Europe | French Impressionist painter | Pierre-Auguste Renoir |
| `hist-osman-hamdi-bey` | Osman Hamdi Bey | 1842–1910 | Artists & Architects | Middle East & North Africa | Ottoman painter and archaeologist | Osman Hamdi Bey |
| `hist-pedro-americo` | Pedro Américo | 1843–1905 | Artists & Architects | Latin America & Caribbean | Brazilian history painter | Pedro Américo |
| `hist-edmonia-lewis` | Edmonia Lewis | c. 1844–1907 | Artists & Architects | North America | American sculptor | Edmonia Lewis |
| `hist-raja-ravi-varma` | Raja Ravi Varma | 1848–1906 | Artists & Architects | South Asia | Indian painter | Raja Ravi Varma |
| `hist-jose-guadalupe-posada` | José Guadalupe Posada | 1852–1913 | Artists & Architects | Latin America & Caribbean | Mexican printmaker and illustrator | José Guadalupe Posada |
| `hist-vincent-van-gogh` | Vincent van Gogh ★ | 1853–1890 | Artists & Architects | Europe | Dutch Post-Impressionist painter | Vincent van Gogh |
| `hist-frederick-mccubbin` | Frederick McCubbin | 1855–1917 | Artists & Architects | Oceania | Australian painter of the Heidelberg School | Frederick McCubbin |
| `hist-john-singer-sargent` | John Singer Sargent | 1856–1925 | Artists & Architects | North America | American portrait painter | John Singer Sargent |
| `hist-gustav-klimt` | Gustav Klimt | 1862–1918 | Artists & Architects | Europe | Austrian Symbolist painter | Gustav Klimt |
| `hist-arturo-michelena` | Arturo Michelena | 1863–1898 | Artists & Architects | Latin America & Caribbean | Venezuelan painter | Arturo Michelena |
| `hist-archimedes` | Archimedes | c. 287 BC – 212 BC | Scientists & Mathematicians | Europe | Greek mathematician of Syracuse | Archimedes |
| `hist-eratosthenes` | Eratosthenes | c. 276 BC – 194 BC | Scientists & Mathematicians | Middle East & North Africa | Greek scholar of Alexandria | Eratosthenes |
| `hist-zhang-heng` | Zhang Heng | 78–139 | Scientists & Mathematicians | East Asia | Chinese polymath of the Han dynasty | Zhang Heng |
| `hist-zu-chongzhi` | Zu Chongzhi | 429–500 | Scientists & Mathematicians | East Asia | Chinese mathematician and astronomer | Zu Chongzhi |
| `hist-aryabhata` | Aryabhata | 476–550 | Scientists & Mathematicians | South Asia | Indian mathematician and astronomer | Aryabhata |
| `hist-avicenna` | Avicenna | c. 980–1037 | Scientists & Mathematicians | Central Asia | Persian physician and philosopher | Avicenna |
| `hist-shen-kuo` | Shen Kuo | 1031–1095 | Scientists & Mathematicians | East Asia | Chinese polymath of the Song dynasty | Shen Kuo |
| `hist-omar-khayyam` | Omar Khayyam | 1048–1131 | Scientists & Mathematicians | Middle East & North Africa | Persian mathematician, astronomer and poet | Omar Khayyam |
| `hist-bhaskara-ii` | Bhāskara II | c. 1114–1185 | Scientists & Mathematicians | South Asia | Indian mathematician and astronomer | Bhāskara II |
| `hist-nasir-al-din-al-tusi` | Nasir al-Din al-Tusi | 1201–1274 | Scientists & Mathematicians | Middle East & North Africa | Persian scholar and astronomer | Nasir al-Din al-Tusi |
| `hist-ulugh-beg` | Ulugh Beg | 1394–1449 | Scientists & Mathematicians | Central Asia | Timurid astronomer and mathematician | Ulugh Beg |
| `hist-nicolaus-copernicus` | Nicolaus Copernicus | 1473–1543 | Scientists & Mathematicians | Europe | Renaissance astronomer of the heliocentric model | Nicolaus Copernicus |
| `hist-li-shizhen` | Li Shizhen | 1518–1593 | Scientists & Mathematicians | East Asia | Chinese physician and naturalist | Li Shizhen |
| `hist-tycho-brahe` | Tycho Brahe | 1546–1601 | Scientists & Mathematicians | Europe | Danish astronomer | Tycho Brahe |
| `hist-galileo-galilei` | Galileo Galilei | 1564–1642 | Scientists & Mathematicians | Europe | Italian astronomer and physicist | Galileo Galilei |
| `hist-johannes-kepler` | Johannes Kepler | 1571–1630 | Scientists & Mathematicians | Europe | German astronomer | Johannes Kepler |
| `hist-isaac-newton` | Isaac Newton ★ | 1643–1727 | Scientists & Mathematicians | Europe | English mathematician and physicist | Isaac Newton |
| `hist-carl-linnaeus` | Carl Linnaeus | 1707–1778 | Scientists & Mathematicians | Europe | Swedish botanist | Carl Linnaeus |
| `hist-leonhard-euler` | Leonhard Euler | 1707–1783 | Scientists & Mathematicians | Europe | Swiss mathematician | Leonhard Euler |
| `hist-benjamin-banneker` | Benjamin Banneker | 1731–1806 | Scientists & Mathematicians | North America | American almanac author and surveyor | Benjamin Banneker |
| `hist-antoine-lavoisier` | Antoine Lavoisier | 1743–1794 | Scientists & Mathematicians | Europe | French chemist | Antoine Lavoisier |
| `hist-caroline-herschel` | Caroline Herschel | 1750–1848 | Scientists & Mathematicians | Europe | German-British astronomer | Caroline Herschel |
| `hist-sophie-germain` | Sophie Germain | 1776–1831 | Scientists & Mathematicians | Europe | French mathematician | Sophie Germain |
| `hist-carl-friedrich-gauss` | Carl Friedrich Gauss | 1777–1855 | Scientists & Mathematicians | Europe | German mathematician | Carl Friedrich Gauss |
| `hist-michael-faraday` | Michael Faraday | 1791–1867 | Scientists & Mathematicians | Europe | English physicist and chemist | Michael Faraday |
| `hist-mary-anning` | Mary Anning | 1799–1847 | Scientists & Mathematicians | Europe | English fossil collector and palaeontologist | Mary Anning |
| `hist-charles-darwin` | Charles Darwin | 1809–1882 | Scientists & Mathematicians | Europe | English naturalist | Charles Darwin |
| `hist-ada-lovelace` | Ada Lovelace | 1815–1852 | Scientists & Mathematicians | Europe | English mathematician who wrote on the Analytical Engine | Ada Lovelace |
| `hist-ignaz-semmelweis` | Ignaz Semmelweis | 1818–1865 | Scientists & Mathematicians | Europe | Hungarian physician | Ignaz Semmelweis |
| `hist-maria-mitchell` | Maria Mitchell | 1818–1889 | Scientists & Mathematicians | North America | American astronomer | Maria Mitchell |
| `hist-elizabeth-blackwell` | Elizabeth Blackwell | 1821–1910 | Scientists & Mathematicians | North America | British-American physician | Elizabeth Blackwell |
| `hist-gregor-mendel` | Gregor Mendel | 1822–1884 | Scientists & Mathematicians | Europe | Moravian scientist of heredity | Gregor Mendel |
| `hist-louis-pasteur` | Louis Pasteur | 1822–1895 | Scientists & Mathematicians | Europe | French chemist and microbiologist | Louis Pasteur |
| `hist-alfred-russel-wallace` | Alfred Russel Wallace | 1823–1913 | Scientists & Mathematicians | Europe | British naturalist | Alfred Russel Wallace |
| `hist-james-clerk-maxwell` | James Clerk Maxwell | 1831–1879 | Scientists & Mathematicians | Europe | Scottish physicist | James Clerk Maxwell |
| `hist-carlos-finlay` | Carlos Finlay | 1833–1915 | Scientists & Mathematicians | Latin America & Caribbean | Cuban epidemiologist | Carlos Finlay |
| `hist-dmitri-mendeleev` | Dmitri Mendeleev | 1834–1907 | Scientists & Mathematicians | Europe | Russian chemist | Dmitri Mendeleev |
| `hist-james-africanus-horton` | James Africanus Horton | 1835–1883 | Scientists & Mathematicians | Sub-Saharan Africa | Sierra Leonean surgeon and writer | James Africanus Horton |
| `hist-josiah-willard-gibbs` | Josiah Willard Gibbs | 1839–1903 | Scientists & Mathematicians | North America | American scientist | Josiah Willard Gibbs |
| `hist-robert-koch` | Robert Koch | 1843–1910 | Scientists & Mathematicians | Europe | German physician and microbiologist | Robert Koch |
| `hist-sofya-kovalevskaya` | Sofya Kovalevskaya | 1850–1891 | Scientists & Mathematicians | Europe | Russian mathematician | Sofya Kovalevskaya |
| `hist-daniel-alcides-carrion` | Daniel Alcides Carrión | 1857–1885 | Scientists & Mathematicians | Latin America & Caribbean | Peruvian medical student | Daniel Alcides Carrión |
| `hist-williamina-fleming` | Williamina Fleming | 1857–1911 | Scientists & Mathematicians | North America | Scottish-American astronomer | Williamina Fleming |
| `hist-pierre-curie` | Pierre Curie | 1859–1906 | Scientists & Mathematicians | Europe | French physicist | Pierre Curie |
| `hist-kadambini-ganguly` | Kadambini Ganguly | 1861–1923 | Scientists & Mathematicians | South Asia | Indian physician | Kadambini Ganguly |
| `hist-anandibai-joshi` | Anandibai Joshi | 1865–1887 | Scientists & Mathematicians | South Asia | One of the first Indian women physicians | Anandibai Joshi |
| `hist-henrietta-swan-leavitt` | Henrietta Swan Leavitt | 1868–1921 | Scientists & Mathematicians | North America | American astronomer | Henrietta Swan Leavitt |
| `hist-oswaldo-cruz` | Oswaldo Cruz | 1872–1917 | Scientists & Mathematicians | Latin America & Caribbean | Brazilian physician | Oswaldo Cruz |
| `hist-srinivasa-ramanujan` | Srinivasa Ramanujan | 1887–1920 | Scientists & Mathematicians | South Asia | Indian mathematician | Srinivasa Ramanujan |
| `hist-johannes-gutenberg` | Johannes Gutenberg | c. 1400–1468 | Inventors & Engineers | Europe | German inventor of movable-type printing in Europe | Johannes Gutenberg |
| `hist-john-harrison` | John Harrison | 1693–1776 | Inventors & Engineers | Europe | English clockmaker of the marine chronometer | John Harrison |
| `hist-benjamin-franklin` | Benjamin Franklin | 1706–1790 | Inventors & Engineers | North America | American polymath, printer and statesman | Benjamin Franklin |
| `hist-hiraga-gennai` | Hiraga Gennai | 1728–1780 | Inventors & Engineers | East Asia | Japanese polymath and inventor | Hiraga Gennai |
| `hist-james-watt` | James Watt | 1736–1819 | Inventors & Engineers | Europe | Scottish inventor and engineer | James Watt |
| `hist-george-stephenson` | George Stephenson | 1781–1848 | Inventors & Engineers | Europe | English railway engineer | George Stephenson |
| `hist-louis-daguerre` | Louis Daguerre | 1787–1851 | Inventors & Engineers | Europe | French photography pioneer | Louis Daguerre |
| `hist-charles-babbage` | Charles Babbage | 1791–1871 | Inventors & Engineers | Europe | English mathematician and inventor | Charles Babbage |
| `hist-samuel-morse` | Samuel Morse | 1791–1872 | Inventors & Engineers | North America | American painter and telegraph inventor | Samuel Morse |
| `hist-tanaka-hisashige` | Tanaka Hisashige | 1799–1881 | Inventors & Engineers | East Asia | Japanese engineer and inventor | Tanaka Hisashige |
| `hist-louis-braille` | Louis Braille | 1809–1852 | Inventors & Engineers | Europe | French inventor of a reading system for blind people | Louis Braille |
| `hist-gustave-eiffel` | Gustave Eiffel | 1832–1923 | Inventors & Engineers | Europe | French civil engineer | Gustave Eiffel |
| `hist-andre-reboucas` | André Rebouças | 1838–1898 | Inventors & Engineers | Latin America & Caribbean | Brazilian engineer and abolitionist | André Rebouças |
| `hist-margaret-e-knight` | Margaret E. Knight | 1838–1914 | Inventors & Engineers | North America | American inventor of paper bag machinery | Margaret E. Knight |
| `hist-josephine-cochrane` | Josephine Cochrane | 1839–1913 | Inventors & Engineers | North America | American inventor of a dishwasher | Josephine Cochrane |
| `hist-alexander-graham-bell` | Alexander Graham Bell | 1847–1922 | Inventors & Engineers | North America | Scottish-born inventor of the telephone | Alexander Graham Bell |
| `hist-granville-woods` | Granville Woods | 1856–1910 | Inventors & Engineers | North America | American inventor | Granville Woods |
| `hist-rudolf-diesel` | Rudolf Diesel | 1858–1913 | Inventors & Engineers | Europe | German inventor of the diesel engine | Rudolf Diesel |
| `hist-zhan-tianyou` | Zhan Tianyou | 1861–1919 | Inventors & Engineers | East Asia | Chinese railway engineer | Zhan Tianyou |
| `hist-wilbur-wright` | Wilbur Wright | 1867–1912 | Inventors & Engineers | North America | American aviation pioneer | Wilbur Wright |
| `hist-li-bai` | Li Bai | 701–762 | Authors & Poets | East Asia | Chinese poet of the Tang dynasty | Li Bai |
| `hist-du-fu` | Du Fu | 712–770 | Authors & Poets | East Asia | Chinese poet of the Tang dynasty | Du Fu |
| `hist-al-mutanabbi` | Al-Mutanabbi | 915–965 | Authors & Poets | Middle East & North Africa | Arab poet | Al-Mutanabbi |
| `hist-ferdowsi` | Ferdowsi | c. 940–1020 | Authors & Poets | Middle East & North Africa | Persian poet of the Shahnameh | Ferdowsi |
| `hist-su-shi` | Su Shi | 1037–1101 | Authors & Poets | East Asia | Chinese poet of the Song dynasty | Su Shi |
| `hist-li-qingzhao` | Li Qingzhao | c. 1084–1155 | Authors & Poets | East Asia | Chinese poet of the Song dynasty | Li Qingzhao |
| `hist-dante-alighieri` | Dante Alighieri | c. 1265–1321 | Authors & Poets | Europe | Italian poet | Dante Alighieri |
| `hist-hafez` | Hafez | c. 1315–1390 | Authors & Poets | Middle East & North Africa | Persian poet | Hafez |
| `hist-alisher-navoi` | Alisher Navoi | 1441–1501 | Authors & Poets | Central Asia | Timurid poet | Alisher Navoi |
| `hist-miguel-de-cervantes` | Miguel de Cervantes | 1547–1616 | Authors & Poets | Europe | Spanish novelist | Miguel de Cervantes |
| `hist-heo-nanseolheon` | Heo Nanseolheon | 1563–1589 | Authors & Poets | East Asia | Korean poet | Heo Nanseolheon |
| `hist-william-shakespeare` | William Shakespeare | 1564–1616 | Authors & Poets | Europe | English playwright and poet | William Shakespeare |
| `hist-moliere` | Molière | 1622–1673 | Authors & Poets | Europe | French playwright and actor | Molière |
| `hist-matsuo-basho` | Matsuo Bashō | 1644–1694 | Authors & Poets | East Asia | Japanese haiku poet | Matsuo Bashō |
| `hist-chikamatsu-monzaemon` | Chikamatsu Monzaemon | 1653–1725 | Authors & Poets | East Asia | Japanese playwright | Chikamatsu Monzaemon |
| `hist-olaudah-equiano` | Olaudah Equiano | c. 1745–1797 | Authors & Poets | Sub-Saharan Africa | Writer and abolitionist of Igbo origin | Olaudah Equiano |
| `hist-johann-wolfgang-von-goethe` | Johann Wolfgang von Goethe | 1749–1832 | Authors & Poets | Europe | German poet and writer | Johann Wolfgang von Goethe |
| `hist-phillis-wheatley` | Phillis Wheatley | c. 1753–1784 | Authors & Poets | North America | West African-born American poet | Phillis Wheatley |
| `hist-kobayashi-issa` | Kobayashi Issa | 1763–1828 | Authors & Poets | East Asia | Japanese haiku poet | Kobayashi Issa |
| `hist-nguyen-du` | Nguyễn Du | 1765–1820 | Authors & Poets | Southeast Asia | Vietnamese poet | Nguyễn Du |
| `hist-bahadur-shah-zafar` | Bahadur Shah Zafar | 1775–1862 | Authors & Poets | South Asia | Last Mughal emperor and Urdu poet | Bahadur Shah Zafar |
| `hist-jane-austen` | Jane Austen | 1775–1817 | Authors & Poets | Europe | English novelist | Jane Austen |
| `hist-sunthorn-phu` | Sunthorn Phu | 1786–1855 | Authors & Poets | Southeast Asia | Thai poet | Sunthorn Phu |
| `hist-francisco-balagtas` | Francisco Balagtas | 1788–1862 | Authors & Poets | Southeast Asia | Filipino poet | Francisco Balagtas |
| `hist-abdullah-bin-abdul-kadir` | Abdullah bin Abdul Kadir | 1796–1854 | Authors & Poets | Southeast Asia | Malay writer and translator | Abdullah bin Abdul Kadir |
| `hist-mary-shelley` | Mary Shelley | 1797–1851 | Authors & Poets | Europe | English novelist | Mary Shelley |
| `hist-mirza-ghalib` | Mirza Ghalib | 1797–1869 | Authors & Poets | South Asia | Urdu and Persian poet | Mirza Ghalib |
| `hist-adam-mickiewicz` | Adam Mickiewicz | 1798–1855 | Authors & Poets | Europe | Polish poet | Adam Mickiewicz |
| `hist-alexander-pushkin` | Alexander Pushkin | 1799–1837 | Authors & Poets | Europe | Russian poet | Alexander Pushkin |
| `hist-victor-hugo` | Victor Hugo | 1802–1885 | Authors & Poets | Europe | French novelist and poet | Victor Hugo |
| `hist-hans-christian-andersen` | Hans Christian Andersen | 1805–1875 | Authors & Poets | Europe | Danish author of fairy tales | Hans Christian Andersen |
| `hist-edgar-allan-poe` | Edgar Allan Poe | 1809–1849 | Authors & Poets | North America | American writer and poet | Edgar Allan Poe |
| `hist-charles-dickens` | Charles Dickens | 1812–1870 | Authors & Poets | Europe | English novelist | Charles Dickens |
| `hist-bhanubhakta-acharya` | Bhanubhakta Acharya | 1814–1868 | Authors & Poets | South Asia | Nepali poet | Bhanubhakta Acharya |
| `hist-gertrudis-gomez-de-avellaneda` | Gertrudis Gómez de Avellaneda | 1814–1873 | Authors & Poets | Latin America & Caribbean | Cuban-Spanish poet and novelist | Gertrudis Gómez de Avellaneda |
| `hist-taras-shevchenko` | Taras Shevchenko | 1814–1861 | Authors & Poets | Europe | Ukrainian poet and artist | Taras Shevchenko |
| `hist-charlotte-bronte` | Charlotte Brontë | 1816–1855 | Authors & Poets | Europe | English novelist | Charlotte Brontë |
| `hist-herman-melville` | Herman Melville | 1819–1891 | Authors & Poets | North America | American novelist | Herman Melville |
| `hist-walt-whitman` | Walt Whitman | 1819–1892 | Authors & Poets | North America | American poet | Walt Whitman |
| `hist-fyodor-dostoevsky` | Fyodor Dostoevsky | 1821–1881 | Authors & Poets | Europe | Russian novelist | Fyodor Dostoevsky |
| `hist-michael-madhusudan-dutt` | Michael Madhusudan Dutt | 1824–1873 | Authors & Poets | South Asia | Bengali poet and dramatist | Michael Madhusudan Dutt |
| `hist-jules-verne` | Jules Verne | 1828–1905 | Authors & Poets | Europe | French novelist | Jules Verne |
| `hist-leo-tolstoy` | Leo Tolstoy | 1828–1910 | Authors & Poets | Europe | Russian novelist | Leo Tolstoy |
| `hist-emily-dickinson` | Emily Dickinson | 1830–1886 | Authors & Poets | North America | American poet | Emily Dickinson |
| `hist-ricardo-palma` | Ricardo Palma | 1833–1919 | Authors & Poets | Latin America & Caribbean | Peruvian writer | Ricardo Palma |
| `hist-mark-twain` | Mark Twain | 1835–1910 | Authors & Poets | North America | American writer and humorist | Mark Twain |
| `hist-jorge-isaacs` | Jorge Isaacs | 1837–1895 | Authors & Poets | Latin America & Caribbean | Colombian novelist | Jorge Isaacs |
| `hist-bankim-chandra-chattopadhyay` | Bankim Chandra Chattopadhyay | 1838–1894 | Authors & Poets | South Asia | Bengali novelist | Bankim Chandra Chattopadhyay |
| `hist-machado-de-assis` | Machado de Assis | 1839–1908 | Authors & Poets | Latin America & Caribbean | Brazilian novelist | Machado de Assis |
| `hist-nam-k-kemal` | Namık Kemal | 1840–1888 | Authors & Poets | Middle East & North Africa | Ottoman poet and writer | Namık Kemal |
| `hist-abai-qunanbaiuly` | Abai Qunanbaiuly | 1845–1904 | Authors & Poets | Central Asia | Kazakh poet and thinker | Abai Qunanbaiuly |
| `hist-oscar-wilde` | Oscar Wilde | 1854–1900 | Authors & Poets | Europe | Irish poet and playwright | Oscar Wilde |
| `hist-olive-schreiner` | Olive Schreiner | 1855–1920 | Authors & Poets | Sub-Saharan Africa | South African novelist | Olive Schreiner |
| `hist-toru-dutt` | Toru Dutt | 1856–1877 | Authors & Poets | South Asia | Indian poet in English and French | Toru Dutt |
| `hist-john-tengo-jabavu` | John Tengo Jabavu | 1859–1921 | Authors & Poets | Sub-Saharan Africa | South African journalist and newspaper editor | John Tengo Jabavu |
| `hist-anton-chekhov` | Anton Chekhov | 1860–1904 | Authors & Poets | Europe | Russian playwright and short-story writer | Anton Chekhov |
| `hist-e-pauline-johnson` | E. Pauline Johnson | 1861–1913 | Authors & Poets | North America | Canadian poet and performer | E. Pauline Johnson |
| `hist-jose-rizal` | José Rizal | 1861–1896 | Authors & Poets | Southeast Asia | Filipino novelist and reformer | José Rizal |
| `hist-mori-ogai` | Mori Ōgai | 1862–1922 | Authors & Poets | East Asia | Japanese novelist and army physician | Mori Ōgai |
| `hist-henry-lawson` | Henry Lawson | 1867–1922 | Authors & Poets | Oceania | Australian writer and poet | Henry Lawson |
| `hist-natsume-soseki` | Natsume Sōseki | 1867–1916 | Authors & Poets | East Asia | Japanese novelist | Natsume Sōseki |
| `hist-ruben-dario` | Rubén Darío | 1867–1916 | Authors & Poets | Latin America & Caribbean | Nicaraguan poet | Rubén Darío |
| `hist-higuchi-ichiyo` | Higuchi Ichiyō | 1872–1896 | Authors & Poets | East Asia | Japanese writer | Higuchi Ichiyō |
| `hist-paul-laurence-dunbar` | Paul Laurence Dunbar | 1872–1906 | Authors & Poets | North America | American poet | Paul Laurence Dunbar |
| `hist-qiu-jin` | Qiu Jin | 1875–1907 | Authors & Poets | East Asia | Chinese poet and revolutionary | Qiu Jin |
| `hist-subramania-bharati` | Subramania Bharati | 1882–1921 | Authors & Poets | South Asia | Tamil poet | Subramania Bharati |
| `hist-franz-kafka` | Franz Kafka | 1883–1924 | Authors & Poets | Europe | Bohemian novelist | Franz Kafka |
| `hist-socrates` | Socrates | c. 470 BC – 399 BC | Philosophers & Thinkers | Europe | Classical Greek philosopher | Socrates |
| `hist-plato` | Plato | c. 428 BC – 348 BC | Philosophers & Thinkers | Europe | Classical Greek philosopher | Plato |
| `hist-aristotle` | Aristotle | 384 BC – 322 BC | Philosophers & Thinkers | Europe | Classical Greek philosopher | Aristotle |
| `hist-marcus-aurelius` | Marcus Aurelius | 121–180 | Philosophers & Thinkers | Europe | Roman emperor and Stoic philosopher | Marcus Aurelius |
| `hist-averroes` | Averroes | 1126–1198 | Philosophers & Thinkers | Middle East & North Africa | Andalusian philosopher | Averroes |
| `hist-ibn-khaldun` | Ibn Khaldun | 1332–1406 | Philosophers & Thinkers | Middle East & North Africa | North African historian | Ibn Khaldun |
| `hist-wang-yangming` | Wang Yangming | 1472–1529 | Philosophers & Thinkers | East Asia | Chinese Ming dynasty philosopher | Wang Yangming |
| `hist-rene-descartes` | René Descartes | 1596–1650 | Philosophers & Thinkers | Europe | French philosopher and mathematician | René Descartes |
| `hist-john-locke` | John Locke | 1632–1704 | Philosophers & Thinkers | Europe | English philosopher | John Locke |
| `hist-gottfried-wilhelm-leibniz` | Gottfried Wilhelm Leibniz | 1646–1716 | Philosophers & Thinkers | Europe | German philosopher and mathematician | Gottfried Wilhelm Leibniz |
| `hist-voltaire` | Voltaire | 1694–1778 | Philosophers & Thinkers | Europe | French Enlightenment writer | Voltaire |
| `hist-david-hume` | David Hume | 1711–1776 | Philosophers & Thinkers | Europe | Scottish philosopher | David Hume |
| `hist-jean-jacques-rousseau` | Jean-Jacques Rousseau | 1712–1778 | Philosophers & Thinkers | Europe | Genevan philosopher | Jean-Jacques Rousseau |
| `hist-adam-smith` | Adam Smith | 1723–1790 | Philosophers & Thinkers | Europe | Scottish economist and philosopher | Adam Smith |
| `hist-immanuel-kant` | Immanuel Kant | 1724–1804 | Philosophers & Thinkers | Europe | German philosopher | Immanuel Kant |
| `hist-thomas-paine` | Thomas Paine | 1737–1809 | Philosophers & Thinkers | North America | English-American political writer | Thomas Paine |
| `hist-mary-wollstonecraft` | Mary Wollstonecraft | 1759–1797 | Philosophers & Thinkers | Europe | English writer and philosopher | Mary Wollstonecraft |
| `hist-jeong-yak-yong` | Jeong Yak-yong | 1762–1836 | Philosophers & Thinkers | East Asia | Korean philosopher | Jeong Yak-yong |
| `hist-andres-bello` | Andrés Bello | 1781–1865 | Philosophers & Thinkers | Latin America & Caribbean | Venezuelan-Chilean humanist and legal scholar | Andrés Bello |
| `hist-ralph-waldo-emerson` | Ralph Waldo Emerson | 1803–1882 | Philosophers & Thinkers | North America | American essayist | Ralph Waldo Emerson |
| `hist-john-stuart-mill` | John Stuart Mill | 1806–1873 | Philosophers & Thinkers | Europe | English philosopher and economist | John Stuart Mill |
| `hist-henry-david-thoreau` | Henry David Thoreau | 1817–1862 | Philosophers & Thinkers | North America | American essayist | Henry David Thoreau |
| `hist-nishi-amane` | Nishi Amane | 1829–1897 | Philosophers & Thinkers | East Asia | Japanese philosopher | Nishi Amane |
| `hist-edward-wilmot-blyden` | Edward Wilmot Blyden | 1832–1912 | Philosophers & Thinkers | Sub-Saharan Africa | Liberian educator and writer | Edward Wilmot Blyden |
| `hist-fukuzawa-yukichi` | Fukuzawa Yukichi | 1835–1901 | Philosophers & Thinkers | East Asia | Japanese educator and writer | Fukuzawa Yukichi |
| `hist-william-james` | William James | 1842–1910 | Philosophers & Thinkers | North America | American philosopher and psychologist | William James |
| `hist-friedrich-nietzsche` | Friedrich Nietzsche | 1844–1900 | Philosophers & Thinkers | Europe | German philosopher | Friedrich Nietzsche |
| `hist-yan-fu` | Yan Fu | 1854–1921 | Philosophers & Thinkers | East Asia | Chinese scholar and translator | Yan Fu |
| `hist-muhammad-al-idrisi` | Muhammad al-Idrisi | 1100–1165 | Explorers & Travellers | Middle East & North Africa | Arab geographer and cartographer | Muhammad al-Idrisi |
| `hist-marco-polo` | Marco Polo | 1254–1324 | Explorers & Travellers | Europe | Venetian merchant and traveller | Marco Polo |
| `hist-ibn-battuta` | Ibn Battuta | c. 1304–1369 | Explorers & Travellers | Middle East & North Africa | Maghrebi traveller and writer | Ibn Battuta |
| `hist-zheng-he` | Zheng He | c. 1371–1433 | Explorers & Travellers | East Asia | Chinese admiral and navigator | Zheng He |
| `hist-ferdinand-magellan` | Ferdinand Magellan | c. 1480–1521 | Explorers & Travellers | Europe | Portuguese navigator | Ferdinand Magellan |
| `hist-xu-xiake` | Xu Xiake | 1587–1641 | Explorers & Travellers | East Asia | Chinese travel writer and geographer | Xu Xiake |
| `hist-james-cook` | James Cook | 1728–1779 | Explorers & Travellers | Europe | British navigator | James Cook |
| `hist-jeanne-baret` | Jeanne Baret | 1740–1807 | Explorers & Travellers | Europe | French botanist who circumnavigated the globe | Jeanne Baret |
| `hist-ino-tadataka` | Inō Tadataka | 1745–1818 | Explorers & Travellers | East Asia | Japanese surveyor and cartographer | Inō Tadataka |
| `hist-alexander-von-humboldt` | Alexander von Humboldt | 1769–1859 | Explorers & Travellers | Europe | German naturalist and explorer | Alexander von Humboldt |
| `hist-meriwether-lewis` | Meriwether Lewis | 1774–1809 | Explorers & Travellers | North America | American explorer | Meriwether Lewis |
| `hist-charles-sturt` | Charles Sturt | 1795–1869 | Explorers & Travellers | Oceania | British explorer of Australia | Charles Sturt |
| `hist-david-livingstone` | David Livingstone | 1813–1873 | Explorers & Travellers | Europe | Scottish explorer of Africa | David Livingstone |
| `hist-nain-singh-rawat` | Nain Singh Rawat | 1830–1882 | Explorers & Travellers | South Asia | Indian explorer of Tibet | Nain Singh Rawat |
| `hist-isabella-bird` | Isabella Bird | 1831–1904 | Explorers & Travellers | Europe | English explorer and writer | Isabella Bird |
| `hist-shokan-valikhanov` | Shokan Valikhanov | 1835–1865 | Explorers & Travellers | Central Asia | Kazakh scholar and explorer | Shokan Valikhanov |
| `hist-francisco-moreno` | Francisco Moreno | 1852–1919 | Explorers & Travellers | Latin America & Caribbean | Argentine explorer | Francisco Moreno |
| `hist-mary-kingsley` | Mary Kingsley | 1862–1900 | Explorers & Travellers | Europe | English explorer and writer | Mary Kingsley |
| `hist-robert-falcon-scott` | Robert Falcon Scott | 1868–1912 | Explorers & Travellers | Europe | British Antarctic explorer | Robert Falcon Scott |
| `hist-ernest-shackleton` | Ernest Shackleton | 1874–1922 | Explorers & Travellers | Europe | Anglo-Irish Antarctic explorer | Ernest Shackleton |
| `hist-tanikaze-kajinosuke` | Tanikaze Kajinosuke | 1750–1795 | Athletes | East Asia | Japanese sumo wrestler | Tanikaze Kajinosuke |
| `hist-bill-richmond` | Bill Richmond | 1763–1829 | Athletes | Europe | American-born boxer in England | Bill Richmond |
| `hist-daniel-mendoza` | Daniel Mendoza | 1764–1836 | Athletes | Europe | English boxer | Daniel Mendoza |
| `hist-raiden-tameemon` | Raiden Tameemon | 1767–1825 | Athletes | East Asia | Japanese sumo wrestler | Raiden Tameemon |
| `hist-tom-molineaux` | Tom Molineaux | 1784–1818 | Athletes | Europe | American-born boxer in England | Tom Molineaux |
| `hist-old-tom-morris` | Old Tom Morris | 1821–1908 | Athletes | Europe | Scottish golfer | Old Tom Morris |
| `hist-tom-wills` | Tom Wills | 1835–1880 | Athletes | Oceania | Australian cricketer and football pioneer | Tom Wills |
| `hist-matthew-webb` | Matthew Webb | 1848–1883 | Athletes | Europe | English swimmer who first swam the English Channel | Matthew Webb |
| `hist-w-g-grace` | W. G. Grace | 1848–1915 | Athletes | Europe | English cricketer | W. G. Grace |
| `hist-young-tom-morris` | Young Tom Morris | 1851–1875 | Athletes | Europe | Scottish golfer | Young Tom Morris |
| `hist-moses-fleetwood-walker` | Moses Fleetwood Walker | 1856–1924 | Athletes | North America | American baseball catcher | Moses Fleetwood Walker |
| `hist-john-l-sullivan` | John L. Sullivan | 1858–1918 | Athletes | North America | American boxer | John L. Sullivan |
| `hist-walter-camp` | Walter Camp | 1859–1925 | Athletes | North America | American football player and coach | Walter Camp |
| `hist-isaac-burns-murphy` | Isaac Burns Murphy | 1861–1896 | Athletes | North America | American jockey | Isaac Burns Murphy |
| `hist-peter-jackson` | Peter Jackson | 1861–1901 | Athletes | Oceania | Australian boxer born in the Danish West Indies | Peter Jackson (boxer) |
| `hist-bob-fitzsimmons` | Bob Fitzsimmons | 1863–1917 | Athletes | Oceania | British-born boxer raised in New Zealand | Bob Fitzsimmons |
| `hist-louis-cyr` | Louis Cyr | 1863–1912 | Athletes | North America | Canadian strongman | Louis Cyr |
| `hist-eugen-sandow` | Eugen Sandow | 1867–1925 | Athletes | Europe | Prussian-born strongman | Eugen Sandow |
| `hist-george-dixon` | George Dixon | 1870–1908 | Athletes | North America | Canadian boxer | George Dixon (boxer) |
| `hist-dave-gallaher` | Dave Gallaher | 1873–1917 | Athletes | Oceania | New Zealand rugby union captain | Dave Gallaher |
| `hist-jaap-eden` | Jaap Eden | 1873–1925 | Athletes | Europe | Dutch speed skater and cyclist | Jaap Eden |
| `hist-joe-gans` | Joe Gans | 1874–1910 | Athletes | North America | American boxer | Joe Gans |
| `hist-victor-trumper` | Victor Trumper | 1877–1915 | Athletes | Oceania | Australian cricketer | Victor Trumper |
| `hist-christy-mathewson` | Christy Mathewson | 1880–1925 | Athletes | North America | American baseball pitcher | Christy Mathewson |
| `hist-les-darcy` | Les Darcy | 1895–1917 | Athletes | Oceania | Australian boxer | Les Darcy |
| `hist-francois-andre-danican-philidor` | François-André Danican Philidor | 1726–1795 | Chess Masters | Europe | French chess player and composer | François-André Danican Philidor |
| `hist-louis-charles-mahe-de-la-bourdonnais` | Louis-Charles Mahé de La Bourdonnais | 1795–1840 | Chess Masters | Europe | French chess master | Louis-Charles Mahé de La Bourdonnais |
| `hist-alexander-mcdonnell` | Alexander McDonnell | 1798–1835 | Chess Masters | Europe | Irish chess player | Alexander McDonnell (chess player) |
| `hist-pierre-charles-fournier-de-saint-amant` | Pierre Charles Fournier de Saint-Amant | 1800–1872 | Chess Masters | Europe | French chess master | Pierre Charles Fournier de Saint-Amant |
| `hist-howard-staunton` | Howard Staunton | c. 1810–1874 | Chess Masters | Europe | English chess master | Howard Staunton |
| `hist-adolf-anderssen` | Adolf Anderssen | 1818–1879 | Chess Masters | Europe | German chess master | Adolf Anderssen |
| `hist-henry-bird` | Henry Bird | 1830–1908 | Chess Masters | Europe | English chess master | Henry Edward Bird |
| `hist-louis-paulsen` | Louis Paulsen | 1833–1891 | Chess Masters | Europe | German chess master | Louis Paulsen |
| `hist-wilhelm-steinitz` | Wilhelm Steinitz | 1836–1900 | Chess Masters | Europe | Austrian-American chess master | Wilhelm Steinitz |
| `hist-paul-morphy` | Paul Morphy | 1837–1884 | Chess Masters | North America | American chess master | Paul Morphy |
| `hist-joseph-henry-blackburne` | Joseph Henry Blackburne | 1841–1924 | Chess Masters | Europe | English chess master | Joseph Henry Blackburne |
| `hist-sam-loyd` | Sam Loyd | 1841–1911 | Chess Masters | North America | American chess problemist and puzzle maker | Sam Loyd |
| `hist-johannes-zukertort` | Johannes Zukertort | 1842–1888 | Chess Masters | Europe | Polish-German chess master | Johannes Zukertort |
| `hist-amos-burn` | Amos Burn | 1848–1925 | Chess Masters | Europe | English chess master | Amos Burn |
| `hist-mikhail-chigorin` | Mikhail Chigorin | 1850–1908 | Chess Masters | Europe | Russian chess master | Mikhail Chigorin |
| `hist-harry-nelson-pillsbury` | Harry Nelson Pillsbury | 1872–1906 | Chess Masters | North America | American chess master | Harry Nelson Pillsbury |
| `hist-rudolf-charousek` | Rudolf Charousek | 1873–1900 | Chess Masters | Europe | Hungarian chess master | Rudolf Charousek |
| `hist-carl-schlechter` | Carl Schlechter | 1874–1918 | Chess Masters | Europe | Austrian chess master | Carl Schlechter |
| `hist-sen-no-rikyu` | Sen no Rikyū | 1522–1591 | Reformers & Other Cultural Figures | East Asia | Japanese tea master | Sen no Rikyū |
| `hist-ignatius-sancho` | Ignatius Sancho | c. 1729–1780 | Reformers & Other Cultural Figures | Europe | British composer and writer | Ignatius Sancho |
| `hist-sequoyah` | Sequoyah | c. 1770–1843 | Reformers & Other Cultural Figures | North America | Creator of the Cherokee syllabary | Sequoyah |
| `hist-elizabeth-fry` | Elizabeth Fry | 1780–1845 | Reformers & Other Cultural Figures | Europe | English prison reformer | Elizabeth Fry |
| `hist-marie-antoine-careme` | Marie-Antoine Carême | 1784–1833 | Reformers & Other Cultural Figures | Europe | French chef | Marie-Antoine Carême |
| `hist-sojourner-truth` | Sojourner Truth | c. 1797–1883 | Reformers & Other Cultural Figures | North America | American abolitionist and women's rights activist | Sojourner Truth |
| `hist-rifaa-al-tahtawi` | Rifa'a al-Tahtawi | 1801–1873 | Reformers & Other Cultural Figures | Middle East & North Africa | Egyptian scholar and translator | Rifa'a al-Tahtawi |
| `hist-mary-seacole` | Mary Seacole | 1805–1881 | Reformers & Other Cultural Figures | Latin America & Caribbean | Jamaican nurse and businesswoman | Mary Seacole |
| `hist-caroline-chisholm` | Caroline Chisholm | 1808–1877 | Reformers & Other Cultural Figures | Oceania | English humanitarian in colonial Australia | Caroline Chisholm |
| `hist-frederick-douglass` | Frederick Douglass | 1818–1895 | Reformers & Other Cultural Figures | North America | American abolitionist and writer | Frederick Douglass |
| `hist-florence-nightingale` | Florence Nightingale | 1820–1910 | Reformers & Other Cultural Figures | Europe | English social reformer and founder of modern nursing | Florence Nightingale |
| `hist-ishwar-chandra-vidyasagar` | Ishwar Chandra Vidyasagar | 1820–1891 | Reformers & Other Cultural Figures | South Asia | Bengali educator and reformer | Ishwar Chandra Vidyasagar |
| `hist-susan-b-anthony` | Susan B. Anthony | 1820–1906 | Reformers & Other Cultural Figures | North America | American women's suffrage leader | Susan B. Anthony |
| `hist-harriet-tubman` | Harriet Tubman | c. 1822–1913 | Reformers & Other Cultural Figures | North America | American abolitionist | Harriet Tubman |
| `hist-jyotirao-phule` | Jyotirao Phule | 1827–1890 | Reformers & Other Cultural Figures | South Asia | Indian social reformer | Jyotirao Phule |
| `hist-ramon-emeterio-betances` | Ramón Emeterio Betances | 1827–1898 | Reformers & Other Cultural Figures | Latin America & Caribbean | Puerto Rican physician and independence advocate | Ramón Emeterio Betances |
| `hist-henri-dunant` | Henri Dunant | 1828–1910 | Reformers & Other Cultural Figures | Europe | Swiss humanitarian | Henri Dunant |
| `hist-luis-gama` | Luís Gama | 1830–1882 | Reformers & Other Cultural Figures | Latin America & Caribbean | Brazilian abolitionist and lawyer | Luís Gama |
| `hist-savitribai-phule` | Savitribai Phule | 1831–1897 | Reformers & Other Cultural Figures | South Asia | Indian educator and social reformer | Savitribai Phule |
| `hist-eugenio-maria-de-hostos` | Eugenio María de Hostos | 1839–1903 | Reformers & Other Cultural Figures | Latin America & Caribbean | Puerto Rican educator and writer | Eugenio María de Hostos |
| `hist-jamsetji-tata` | Jamsetji Tata | 1839–1904 | Reformers & Other Cultural Figures | South Asia | Indian industrialist | Jamsetji Tata |
| `hist-bertha-von-suttner` | Bertha von Suttner | 1843–1914 | Reformers & Other Cultural Figures | Europe | Austrian peace activist and novelist | Bertha von Suttner |
| `hist-louisa-lawson` | Louisa Lawson | 1848–1920 | Reformers & Other Cultural Figures | Oceania | Australian publisher and suffragist | Louisa Lawson |
| `hist-joaquim-nabuco` | Joaquim Nabuco | 1849–1910 | Reformers & Other Cultural Figures | Latin America & Caribbean | Brazilian abolitionist and diplomat | Joaquim Nabuco |
| `hist-booker-t-washington` | Booker T. Washington | 1856–1915 | Reformers & Other Cultural Figures | North America | American educator | Booker T. Washington |
| `hist-qasim-amin` | Qasim Amin | 1863–1908 | Reformers & Other Cultural Figures | Middle East & North Africa | Egyptian jurist and writer | Qasim Amin |
| `hist-nellie-bly` | Nellie Bly | 1864–1922 | Reformers & Other Cultural Figures | North America | American journalist | Nellie Bly |
| `hist-madam-c-j-walker` | Madam C. J. Walker | 1867–1919 | Reformers & Other Cultural Figures | North America | American entrepreneur | Madam C. J. Walker |
| `hist-kartini` | Kartini | 1879–1904 | Reformers & Other Cultural Figures | Southeast Asia | Javanese advocate of women's education | Kartini |

<!-- roster:generated:end -->

## Contemporary roster

<!-- roster:contemporary:begin -->

**350 identities** (191 living, 159 deceased after 1925, as of compilation). Generated from `src/federation/rosterContemporary.json` by `npx tsx tools/roster/gen-doc.mts`; do not edit by hand. Owner-named people are marked ★.

| Category | Europe | North America | Latin America & Caribbean | Sub-Saharan Africa | Middle East & North Africa | Central Asia | South Asia | East Asia | Southeast Asia | Oceania | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Leaders & Statespeople | 14 | 10 | 7 | 8 | 7 | 2 | 9 | 3 | 4 | 4 | 68 |
| Musicians & Composers | 9 | 14 | 5 | 5 | 3 | 0 | 3 | 4 | 0 | 2 | 45 |
| Actors & Performers | 6 | 14 | 1 | 1 | 1 | 0 | 4 | 3 | 1 | 4 | 35 |
| Artists & Architects | 5 | 3 | 2 | 2 | 1 | 0 | 2 | 5 | 0 | 1 | 21 |
| Scientists & Mathematicians | 9 | 4 | 1 | 0 | 3 | 0 | 3 | 3 | 0 | 2 | 25 |
| Inventors & Engineers | 3 | 6 | 1 | 2 | 0 | 0 | 1 | 2 | 0 | 0 | 15 |
| Authors & Poets | 6 | 5 | 5 | 4 | 3 | 0 | 2 | 4 | 2 | 1 | 32 |
| Philosophers & Thinkers | 6 | 3 | 2 | 1 | 1 | 0 | 2 | 0 | 0 | 1 | 16 |
| Explorers & Travellers | 4 | 4 | 1 | 0 | 1 | 1 | 2 | 2 | 1 | 1 | 17 |
| Athletes | 7 | 11 | 7 | 4 | 2 | 2 | 4 | 5 | 2 | 4 | 48 |
| Chess Masters | 5 | 2 | 1 | 0 | 1 | 1 | 1 | 2 | 1 | 0 | 14 |
| Reformers & Other Cultural Figures | 2 | 5 | 1 | 1 | 2 | 0 | 2 | 0 | 0 | 1 | 14 |
| **Total** | 76 | 81 | 34 | 28 | 25 | 6 | 35 | 33 | 11 | 21 | 350 |

### Contemporary provenance

| Id | Name | Living | Category | Region | Descriptor | Reference (English Wikipedia title) |
|---|---|---|---|---|---|---|
| `pub-abdullah-ii-of-jordan` | Abdullah II of Jordan | yes | Leaders & Statespeople | Middle East & North Africa | King of Jordan | Abdullah II of Jordan |
| `pub-angela-merkel` | Angela Merkel | yes | Leaders & Statespeople | Europe | Former Chancellor of Germany | Angela Merkel |
| `pub-anwar-sadat` | Anwar Sadat | no | Leaders & Statespeople | Middle East & North Africa | President of Egypt | Anwar Sadat |
| `pub-atal-bihari-vajpayee` | Atal Bihari Vajpayee | no | Leaders & Statespeople | South Asia | Prime Minister of India | Atal Bihari Vajpayee |
| `pub-ban-ki-moon` | Ban Ki-moon | yes | Leaders & Statespeople | East Asia | Former Secretary-General of the United Nations | Ban Ki-moon |
| `pub-barack-obama` | Barack Obama ★ | yes | Leaders & Statespeople | North America | 44th President of the United States | Barack Obama |
| `pub-benazir-bhutto` | Benazir Bhutto | no | Leaders & Statespeople | South Asia | Prime Minister of Pakistan | Benazir Bhutto |
| `pub-bill-clinton` | Bill Clinton | yes | Leaders & Statespeople | North America | 42nd President of the United States | Bill Clinton |
| `pub-charles-de-gaulle` | Charles de Gaulle | no | Leaders & Statespeople | Europe | President of France | Charles de Gaulle |
| `pub-charles-iii` | Charles III | yes | Leaders & Statespeople | Europe | King of the United Kingdom | Charles III |
| `pub-claudia-sheinbaum` | Claudia Sheinbaum | yes | Leaders & Statespeople | Latin America & Caribbean | President of Mexico | Claudia Sheinbaum |
| `pub-condoleezza-rice` | Condoleezza Rice | yes | Leaders & Statespeople | North America | 66th United States Secretary of State | Condoleezza Rice |
| `pub-corazon-aquino` | Corazon Aquino | no | Leaders & Statespeople | Southeast Asia | President of the Philippines | Corazon Aquino |
| `pub-cyril-ramaphosa` | Cyril Ramaphosa | yes | Leaders & Statespeople | Sub-Saharan Africa | President of South Africa | Cyril Ramaphosa |
| `pub-donald-trump` | Donald Trump ★ | yes | Leaders & Statespeople | North America | 45th and 47th President of the United States | Donald Trump |
| `pub-elizabeth-ii` | Elizabeth II | no | Leaders & Statespeople | Europe | Queen of the United Kingdom | Elizabeth II |
| `pub-ellen-johnson-sirleaf` | Ellen Johnson Sirleaf | yes | Leaders & Statespeople | Sub-Saharan Africa | Former President of Liberia | Ellen Johnson Sirleaf |
| `pub-emmanuel-macron` | Emmanuel Macron | yes | Leaders & Statespeople | Europe | President of France | Emmanuel Macron |
| `pub-george-w-bush` | George W. Bush | yes | Leaders & Statespeople | North America | 43rd President of the United States | George W. Bush |
| `pub-giorgia-meloni` | Giorgia Meloni | yes | Leaders & Statespeople | Europe | Prime Minister of Italy | Giorgia Meloni |
| `pub-golda-meir` | Golda Meir | no | Leaders & Statespeople | Middle East & North Africa | Prime Minister of Israel | Golda Meir |
| `pub-indira-gandhi` | Indira Gandhi | no | Leaders & Statespeople | South Asia | Prime Minister of India | Indira Gandhi |
| `pub-jacinda-ardern` | Jacinda Ardern | yes | Leaders & Statespeople | Oceania | Former Prime Minister of New Zealand | Jacinda Ardern |
| `pub-javier-milei` | Javier Milei | yes | Leaders & Statespeople | Latin America & Caribbean | President of Argentina | Javier Milei |
| `pub-jawaharlal-nehru` | Jawaharlal Nehru | no | Leaders & Statespeople | South Asia | First Prime Minister of India | Jawaharlal Nehru |
| `pub-joe-biden` | Joe Biden | yes | Leaders & Statespeople | North America | 46th President of the United States | Joe Biden |
| `pub-john-f-kennedy` | John F. Kennedy | no | Leaders & Statespeople | North America | 35th President of the United States | John F. Kennedy |
| `pub-john-howard` | John Howard | yes | Leaders & Statespeople | Oceania | Former Prime Minister of Australia | John Howard |
| `pub-john-key` | John Key | yes | Leaders & Statespeople | Oceania | Former Prime Minister of New Zealand | John Key |
| `pub-joko-widodo` | Joko Widodo | yes | Leaders & Statespeople | Southeast Asia | Former President of Indonesia | Joko Widodo |
| `pub-jose-mujica` | José Mujica | no | Leaders & Statespeople | Latin America & Caribbean | Former President of Uruguay | José Mujica |
| `pub-jose-ramos-horta` | José Ramos-Horta | yes | Leaders & Statespeople | Southeast Asia | President of Timor-Leste | José Ramos-Horta |
| `pub-julia-gillard` | Julia Gillard | yes | Leaders & Statespeople | Oceania | Former Prime Minister of Australia | Julia Gillard |
| `pub-julius-nyerere` | Julius Nyerere | no | Leaders & Statespeople | Sub-Saharan Africa | First President of Tanzania | Julius Nyerere |
| `pub-justin-trudeau` | Justin Trudeau | yes | Leaders & Statespeople | North America | 23rd Prime Minister of Canada | Justin Trudeau |
| `pub-kassym-jomart-tokayev` | Kassym-Jomart Tokayev | yes | Leaders & Statespeople | Central Asia | President of Kazakhstan | Kassym-Jomart Tokayev |
| `pub-keir-starmer` | Keir Starmer | yes | Leaders & Statespeople | Europe | Prime Minister of the United Kingdom | Keir Starmer |
| `pub-kenneth-kaunda` | Kenneth Kaunda | no | Leaders & Statespeople | Sub-Saharan Africa | First President of Zambia | Kenneth Kaunda |
| `pub-kofi-annan` | Kofi Annan | no | Leaders & Statespeople | Sub-Saharan Africa | Secretary-General of the United Nations | Kofi Annan |
| `pub-kwame-nkrumah` | Kwame Nkrumah | no | Leaders & Statespeople | Sub-Saharan Africa | First President of Ghana | Kwame Nkrumah |
| `pub-lech-walesa` | Lech Wałęsa | yes | Leaders & Statespeople | Europe | Former President of Poland | Lech Wałęsa |
| `pub-lee-kuan-yew` | Lee Kuan Yew | no | Leaders & Statespeople | Southeast Asia | First Prime Minister of Singapore | Lee Kuan Yew |
| `pub-leopold-sedar-senghor` | Léopold Sédar Senghor | no | Leaders & Statespeople | Sub-Saharan Africa | First President of Senegal | Léopold Sédar Senghor |
| `pub-luiz-inacio-lula-da-silva` | Luiz Inácio Lula da Silva | yes | Leaders & Statespeople | Latin America & Caribbean | President of Brazil | Luiz Inácio Lula da Silva |
| `pub-mahatma-gandhi` | Mahatma Gandhi | no | Leaders & Statespeople | South Asia | Leader of the Indian independence movement | Mahatma Gandhi |
| `pub-margaret-thatcher` | Margaret Thatcher | no | Leaders & Statespeople | Europe | Prime Minister of the United Kingdom | Margaret Thatcher |
| `pub-menachem-begin` | Menachem Begin | no | Leaders & Statespeople | Middle East & North Africa | Prime Minister of Israel | Menachem Begin |
| `pub-michelle-bachelet` | Michelle Bachelet | yes | Leaders & Statespeople | Latin America & Caribbean | Former President of Chile | Michelle Bachelet |
| `pub-mikhail-gorbachev` | Mikhail Gorbachev | no | Leaders & Statespeople | Europe | Leader of the Soviet Union | Mikhail Gorbachev |
| `pub-muhammad-ali-jinnah` | Muhammad Ali Jinnah | no | Leaders & Statespeople | South Asia | Founder of Pakistan | Muhammad Ali Jinnah |
| `pub-mustafa-kemal-ataturk` | Mustafa Kemal Atatürk | no | Leaders & Statespeople | Middle East & North Africa | Founding President of Turkey | Mustafa Kemal Atatürk |
| `pub-narendra-modi` | Narendra Modi | yes | Leaders & Statespeople | South Asia | Prime Minister of India | Narendra Modi |
| `pub-nelson-mandela` | Nelson Mandela | no | Leaders & Statespeople | Sub-Saharan Africa | President of South Africa | Nelson Mandela |
| `pub-recep-tayyip-erdogan` | Recep Tayyip Erdoğan | yes | Leaders & Statespeople | Middle East & North Africa | President of Turkey | Recep Tayyip Erdoğan |
| `pub-ronald-reagan` | Ronald Reagan | no | Leaders & Statespeople | North America | 40th President of the United States | Ronald Reagan |
| `pub-roza-otunbayeva` | Roza Otunbayeva | yes | Leaders & Statespeople | Central Asia | Former President of Kyrgyzstan | Roza Otunbayeva |
| `pub-sebastian-pinera` | Sebastián Piñera | no | Leaders & Statespeople | Latin America & Caribbean | Former President of Chile | Sebastián Piñera |
| `pub-sheikh-mujibur-rahman` | Sheikh Mujibur Rahman | no | Leaders & Statespeople | South Asia | Founding leader of Bangladesh | Sheikh Mujibur Rahman |
| `pub-shinzo-abe` | Shinzo Abe | no | Leaders & Statespeople | East Asia | Prime Minister of Japan | Shinzo Abe |
| `pub-sirimavo-bandaranaike` | Sirimavo Bandaranaike | no | Leaders & Statespeople | South Asia | Prime Minister of Sri Lanka | Sirimavo Bandaranaike |
| `pub-stephen-harper` | Stephen Harper | yes | Leaders & Statespeople | North America | 22nd Prime Minister of Canada | Stephen Harper |
| `pub-tony-blair` | Tony Blair | yes | Leaders & Statespeople | Europe | Former Prime Minister of the United Kingdom | Tony Blair |
| `pub-vicente-fox` | Vicente Fox | yes | Leaders & Statespeople | Latin America & Caribbean | Former President of Mexico | Vicente Fox |
| `pub-viktor-orban` | Viktor Orbán | yes | Leaders & Statespeople | Europe | Prime Minister of Hungary | Viktor Orbán |
| `pub-volodymyr-zelenskyy` | Volodymyr Zelenskyy | yes | Leaders & Statespeople | Europe | President of Ukraine | Volodymyr Zelenskyy |
| `pub-winston-churchill` | Winston Churchill | no | Leaders & Statespeople | Europe | Prime Minister of the United Kingdom | Winston Churchill |
| `pub-xi-jinping` | Xi Jinping | yes | Leaders & Statespeople | East Asia | President of the People's Republic of China | Xi Jinping |
| `pub-yitzhak-rabin` | Yitzhak Rabin | no | Leaders & Statespeople | Middle East & North Africa | Prime Minister of Israel | Yitzhak Rabin |
| `pub-a-r-rahman` | A. R. Rahman | yes | Musicians & Composers | South Asia | Indian composer | A. R. Rahman |
| `pub-adele` | Adele | yes | Musicians & Composers | Europe | English singer-songwriter | Adele |
| `pub-amr-diab` | Amr Diab | yes | Musicians & Composers | Middle East & North Africa | Egyptian singer | Amr Diab |
| `pub-andrea-bocelli` | Andrea Bocelli | yes | Musicians & Composers | Europe | Italian tenor | Andrea Bocelli |
| `pub-angelique-kidjo` | Angélique Kidjo | yes | Musicians & Composers | Sub-Saharan Africa | Beninese singer-songwriter | Angélique Kidjo |
| `pub-aretha-franklin` | Aretha Franklin | no | Musicians & Composers | North America | American singer and pianist | Aretha Franklin |
| `pub-bad-bunny` | Bad Bunny | yes | Musicians & Composers | Latin America & Caribbean | Puerto Rican rapper and singer | Bad Bunny |
| `pub-beyonce` | Beyoncé ★ | yes | Musicians & Composers | North America | American singer and songwriter | Beyoncé |
| `pub-bob-dylan` | Bob Dylan | yes | Musicians & Composers | North America | American singer-songwriter | Bob Dylan |
| `pub-bob-marley` | Bob Marley | no | Musicians & Composers | Latin America & Caribbean | Jamaican singer-songwriter | Bob Marley |
| `pub-burna-boy` | Burna Boy | yes | Musicians & Composers | Sub-Saharan Africa | Nigerian singer | Burna Boy |
| `pub-caetano-veloso` | Caetano Veloso | yes | Musicians & Composers | Latin America & Caribbean | Brazilian singer-songwriter | Caetano Veloso |
| `pub-david-bowie` | David Bowie | no | Musicians & Composers | Europe | English singer-songwriter | David Bowie |
| `pub-drake` | Drake ★ | yes | Musicians & Composers | North America | Canadian rapper and singer | Drake (musician) |
| `pub-ed-sheeran` | Ed Sheeran | yes | Musicians & Composers | Europe | English singer-songwriter | Ed Sheeran |
| `pub-edith-piaf` | Édith Piaf | no | Musicians & Composers | Europe | French singer | Édith Piaf |
| `pub-elton-john` | Elton John | yes | Musicians & Composers | Europe | English singer, pianist and composer | Elton John |
| `pub-elvis-presley` | Elvis Presley | no | Musicians & Composers | North America | American singer and actor | Elvis Presley |
| `pub-eminem` | Eminem | yes | Musicians & Composers | North America | American rapper | Eminem |
| `pub-fela-kuti` | Fela Kuti | no | Musicians & Composers | Sub-Saharan Africa | Nigerian musician | Fela Kuti |
| `pub-frank-sinatra` | Frank Sinatra | no | Musicians & Composers | North America | American singer and actor | Frank Sinatra |
| `pub-freddie-mercury` | Freddie Mercury | no | Musicians & Composers | Europe | British singer and songwriter | Freddie Mercury |
| `pub-googoosh` | Googoosh | yes | Musicians & Composers | Middle East & North Africa | Iranian singer | Googoosh |
| `pub-jay-chou` | Jay Chou | yes | Musicians & Composers | East Asia | Taiwanese singer-songwriter | Jay Chou |
| `pub-john-lennon` | John Lennon | no | Musicians & Composers | Europe | English singer-songwriter | John Lennon |
| `pub-kylie-minogue` | Kylie Minogue | yes | Musicians & Composers | Oceania | Australian singer | Kylie Minogue |
| `pub-lady-gaga` | Lady Gaga | yes | Musicians & Composers | North America | American singer, songwriter and actress | Lady Gaga |
| `pub-lang-lang` | Lang Lang | yes | Musicians & Composers | East Asia | Chinese pianist | Lang Lang |
| `pub-lata-mangeshkar` | Lata Mangeshkar | no | Musicians & Composers | South Asia | Indian playback singer | Lata Mangeshkar |
| `pub-lorde` | Lorde | yes | Musicians & Composers | Oceania | New Zealand singer-songwriter | Lorde |
| `pub-madonna` | Madonna | yes | Musicians & Composers | North America | American singer and songwriter | Madonna |
| `pub-michael-jackson` | Michael Jackson ★ | no | Musicians & Composers | North America | American singer, songwriter and dancer | Michael Jackson |
| `pub-miriam-makeba` | Miriam Makeba | no | Musicians & Composers | Sub-Saharan Africa | South African singer | Miriam Makeba |
| `pub-nusrat-fateh-ali-khan` | Nusrat Fateh Ali Khan | no | Musicians & Composers | South Asia | Pakistani singer | Nusrat Fateh Ali Khan |
| `pub-paul-mccartney` | Paul McCartney | yes | Musicians & Composers | Europe | English singer-songwriter and bassist | Paul McCartney |
| `pub-prince` | Prince | no | Musicians & Composers | North America | American singer, songwriter and musician | Prince (musician) |
| `pub-rihanna` | Rihanna | yes | Musicians & Composers | Latin America & Caribbean | Barbadian singer | Rihanna |
| `pub-ryuichi-sakamoto` | Ryuichi Sakamoto | no | Musicians & Composers | East Asia | Japanese composer and musician | Ryuichi Sakamoto |
| `pub-shakira` | Shakira | yes | Musicians & Composers | Latin America & Caribbean | Colombian singer-songwriter | Shakira |
| `pub-stevie-wonder` | Stevie Wonder | yes | Musicians & Composers | North America | American singer, songwriter and musician | Stevie Wonder |
| `pub-taylor-swift` | Taylor Swift ★ | yes | Musicians & Composers | North America | American singer-songwriter | Taylor Swift |
| `pub-teresa-teng` | Teresa Teng | no | Musicians & Composers | East Asia | Taiwanese singer | Teresa Teng |
| `pub-umm-kulthum` | Umm Kulthum | no | Musicians & Composers | Middle East & North Africa | Egyptian singer | Umm Kulthum |
| `pub-whitney-houston` | Whitney Houston | no | Musicians & Composers | North America | American singer | Whitney Houston |
| `pub-youssou-n-dour` | Youssou N'Dour | yes | Musicians & Composers | Sub-Saharan Africa | Senegalese singer | Youssou N'Dour |
| `pub-amitabh-bachchan` | Amitabh Bachchan | yes | Actors & Performers | South Asia | Indian actor | Amitabh Bachchan |
| `pub-anthony-hopkins` | Anthony Hopkins | yes | Actors & Performers | Europe | Welsh actor | Anthony Hopkins |
| `pub-audrey-hepburn` | Audrey Hepburn | no | Actors & Performers | Europe | British actress | Audrey Hepburn |
| `pub-bruce-lee` | Bruce Lee | no | Actors & Performers | East Asia | Hong Kong-American actor and martial artist | Bruce Lee |
| `pub-cate-blanchett` | Cate Blanchett | yes | Actors & Performers | Oceania | Australian actress | Cate Blanchett |
| `pub-charlie-chaplin` | Charlie Chaplin | no | Actors & Performers | Europe | English comic actor and filmmaker | Charlie Chaplin |
| `pub-denzel-washington` | Denzel Washington | yes | Actors & Performers | North America | American actor | Denzel Washington |
| `pub-dwayne-johnson` | Dwayne Johnson | yes | Actors & Performers | North America | American actor | Dwayne Johnson |
| `pub-emma-watson` | Emma Watson | yes | Actors & Performers | Europe | English actress | Emma Watson |
| `pub-gong-li` | Gong Li | yes | Actors & Performers | East Asia | Chinese actress | Gong Li |
| `pub-hugh-jackman` | Hugh Jackman | yes | Actors & Performers | Oceania | Australian actor | Hugh Jackman |
| `pub-idris-elba` | Idris Elba | yes | Actors & Performers | Europe | English actor | Idris Elba |
| `pub-jackie-chan` | Jackie Chan | yes | Actors & Performers | East Asia | Hong Kong actor and martial artist | Jackie Chan |
| `pub-keanu-reeves` | Keanu Reeves | yes | Actors & Performers | North America | Canadian actor | Keanu Reeves |
| `pub-leonardo-dicaprio` | Leonardo DiCaprio ★ | yes | Actors & Performers | North America | American actor | Leonardo DiCaprio |
| `pub-lupita-nyong-o` | Lupita Nyong'o | yes | Actors & Performers | Sub-Saharan Africa | Kenyan-Mexican actress | Lupita Nyong'o |
| `pub-marilyn-monroe` | Marilyn Monroe | no | Actors & Performers | North America | American actress | Marilyn Monroe |
| `pub-marlon-brando` | Marlon Brando | no | Actors & Performers | North America | American actor | Marlon Brando |
| `pub-meryl-streep` | Meryl Streep | yes | Actors & Performers | North America | American actress | Meryl Streep |
| `pub-michelle-yeoh` | Michelle Yeoh | yes | Actors & Performers | Southeast Asia | Malaysian actress | Michelle Yeoh |
| `pub-morgan-freeman` | Morgan Freeman ★ | yes | Actors & Performers | North America | American actor | Morgan Freeman |
| `pub-nicole-kidman` | Nicole Kidman | yes | Actors & Performers | Oceania | Australian-American actress | Nicole Kidman |
| `pub-omar-sharif` | Omar Sharif | no | Actors & Performers | Middle East & North Africa | Egyptian actor | Omar Sharif |
| `pub-oprah-winfrey` | Oprah Winfrey | yes | Actors & Performers | North America | American television host | Oprah Winfrey |
| `pub-priyanka-chopra` | Priyanka Chopra | yes | Actors & Performers | South Asia | Indian actress | Priyanka Chopra |
| `pub-rajinikanth` | Rajinikanth | yes | Actors & Performers | South Asia | Indian actor | Rajinikanth |
| `pub-robert-de-niro` | Robert De Niro | yes | Actors & Performers | North America | American actor | Robert De Niro |
| `pub-salma-hayek` | Salma Hayek | yes | Actors & Performers | Latin America & Caribbean | Mexican-American actress | Salma Hayek |
| `pub-sean-connery` | Sean Connery | no | Actors & Performers | Europe | Scottish actor | Sean Connery |
| `pub-shah-rukh-khan` | Shah Rukh Khan | yes | Actors & Performers | South Asia | Indian actor | Shah Rukh Khan |
| `pub-sidney-poitier` | Sidney Poitier | no | Actors & Performers | North America | Bahamian-American actor | Sidney Poitier |
| `pub-steve-irwin` | Steve Irwin | no | Actors & Performers | Oceania | Australian wildlife television presenter | Steve Irwin |
| `pub-tom-cruise` | Tom Cruise ★ | yes | Actors & Performers | North America | American actor | Tom Cruise |
| `pub-tom-hanks` | Tom Hanks | yes | Actors & Performers | North America | American actor | Tom Hanks |
| `pub-zendaya` | Zendaya | yes | Actors & Performers | North America | American actress and singer | Zendaya |
| `pub-ai-weiwei` | Ai Weiwei | yes | Artists & Architects | East Asia | Chinese artist | Ai Weiwei |
| `pub-akira-kurosawa` | Akira Kurosawa | no | Artists & Architects | East Asia | Japanese filmmaker | Akira Kurosawa |
| `pub-alfred-hitchcock` | Alfred Hitchcock | no | Artists & Architects | Europe | English filmmaker | Alfred Hitchcock |
| `pub-amrita-sher-gil` | Amrita Sher-Gil | no | Artists & Architects | South Asia | Hungarian-Indian painter | Amrita Sher-Gil |
| `pub-andy-warhol` | Andy Warhol | no | Artists & Architects | North America | American pop artist | Andy Warhol |
| `pub-bong-joon-ho` | Bong Joon-ho | yes | Artists & Architects | East Asia | South Korean filmmaker | Bong Joon-ho |
| `pub-christopher-nolan` | Christopher Nolan | yes | Artists & Architects | Europe | British-American filmmaker | Christopher Nolan |
| `pub-el-anatsui` | El Anatsui | yes | Artists & Architects | Sub-Saharan Africa | Ghanaian sculptor | El Anatsui |
| `pub-frank-lloyd-wright` | Frank Lloyd Wright | no | Artists & Architects | North America | American architect | Frank Lloyd Wright |
| `pub-frida-kahlo` | Frida Kahlo | no | Artists & Architects | Latin America & Caribbean | Mexican painter | Frida Kahlo |
| `pub-guillermo-del-toro` | Guillermo del Toro | yes | Artists & Architects | Latin America & Caribbean | Mexican filmmaker | Guillermo del Toro |
| `pub-hayao-miyazaki` | Hayao Miyazaki | yes | Artists & Architects | East Asia | Japanese animator and filmmaker | Hayao Miyazaki |
| `pub-henri-matisse` | Henri Matisse | no | Artists & Architects | Europe | French painter | Henri Matisse |
| `pub-ousmane-sembene` | Ousmane Sembène | no | Artists & Architects | Sub-Saharan Africa | Senegalese filmmaker and writer | Ousmane Sembène |
| `pub-pablo-picasso` | Pablo Picasso | no | Artists & Architects | Europe | Spanish painter and sculptor | Pablo Picasso |
| `pub-salvador-dali` | Salvador Dalí | no | Artists & Architects | Europe | Spanish Surrealist painter | Salvador Dalí |
| `pub-satyajit-ray` | Satyajit Ray | no | Artists & Architects | South Asia | Indian filmmaker | Satyajit Ray |
| `pub-shigeru-miyamoto` | Shigeru Miyamoto | yes | Artists & Architects | East Asia | Japanese video game designer | Shigeru Miyamoto |
| `pub-steven-spielberg` | Steven Spielberg | yes | Artists & Architects | North America | American filmmaker | Steven Spielberg |
| `pub-taika-waititi` | Taika Waititi | yes | Artists & Architects | Oceania | New Zealand filmmaker and actor | Taika Waititi |
| `pub-zaha-hadid` | Zaha Hadid | no | Artists & Architects | Middle East & North Africa | Iraqi-British architect | Zaha Hadid |
| `pub-a-p-j-abdul-kalam` | A. P. J. Abdul Kalam | no | Scientists & Mathematicians | South Asia | Indian aerospace scientist and 11th President of India | A. P. J. Abdul Kalam |
| `pub-abdus-salam` | Abdus Salam | no | Scientists & Mathematicians | South Asia | Pakistani theoretical physicist | Abdus Salam |
| `pub-ada-yonath` | Ada Yonath | yes | Scientists & Mathematicians | Middle East & North Africa | Israeli crystallographer | Ada Yonath |
| `pub-ahmed-zewail` | Ahmed Zewail | no | Scientists & Mathematicians | Middle East & North Africa | Egyptian-American chemist | Ahmed Zewail |
| `pub-alan-turing` | Alan Turing | no | Scientists & Mathematicians | Europe | English mathematician and computer scientist | Alan Turing |
| `pub-albert-einstein` | Albert Einstein ★ | no | Scientists & Mathematicians | Europe | German-born theoretical physicist | Albert Einstein |
| `pub-c-v-raman` | C. V. Raman | no | Scientists & Mathematicians | South Asia | Indian physicist | C. V. Raman |
| `pub-carl-sagan` | Carl Sagan | no | Scientists & Mathematicians | North America | American astronomer and science communicator | Carl Sagan |
| `pub-chien-shiung-wu` | Chien-Shiung Wu | no | Scientists & Mathematicians | East Asia | Chinese-American physicist | Chien-Shiung Wu |
| `pub-elizabeth-blackburn` | Elizabeth Blackburn | yes | Scientists & Mathematicians | Oceania | Australian-American molecular biologist | Elizabeth Blackburn |
| `pub-emmy-noether` | Emmy Noether | no | Scientists & Mathematicians | Europe | German mathematician | Emmy Noether |
| `pub-hideki-yukawa` | Hideki Yukawa | no | Scientists & Mathematicians | East Asia | Japanese theoretical physicist | Hideki Yukawa |
| `pub-jane-goodall` | Jane Goodall | no | Scientists & Mathematicians | Europe | English primatologist | Jane Goodall |
| `pub-jennifer-doudna` | Jennifer Doudna | yes | Scientists & Mathematicians | North America | American biochemist | Jennifer Doudna |
| `pub-katalin-kariko` | Katalin Karikó | yes | Scientists & Mathematicians | Europe | Hungarian-American biochemist | Katalin Karikó |
| `pub-katherine-johnson` | Katherine Johnson | no | Scientists & Mathematicians | North America | American mathematician | Katherine Johnson |
| `pub-lise-meitner` | Lise Meitner | no | Scientists & Mathematicians | Europe | Austrian-Swedish physicist | Lise Meitner |
| `pub-marie-curie` | Marie Curie ★ | no | Scientists & Mathematicians | Europe | Polish-French physicist and chemist | Marie Curie |
| `pub-mario-molina` | Mario Molina | no | Scientists & Mathematicians | Latin America & Caribbean | Mexican chemist | Mario Molina |
| `pub-maryam-mirzakhani` | Maryam Mirzakhani | no | Scientists & Mathematicians | Middle East & North Africa | Iranian mathematician | Maryam Mirzakhani |
| `pub-richard-feynman` | Richard Feynman | no | Scientists & Mathematicians | North America | American theoretical physicist | Richard Feynman |
| `pub-rosalind-franklin` | Rosalind Franklin | no | Scientists & Mathematicians | Europe | English chemist and X-ray crystallographer | Rosalind Franklin |
| `pub-shinya-yamanaka` | Shinya Yamanaka | yes | Scientists & Mathematicians | East Asia | Japanese stem cell researcher | Shinya Yamanaka |
| `pub-stephen-hawking` | Stephen Hawking | no | Scientists & Mathematicians | Europe | English theoretical physicist | Stephen Hawking |
| `pub-terence-tao` | Terence Tao | yes | Scientists & Mathematicians | Oceania | Australian-American mathematician | Terence Tao |
| `pub-akio-morita` | Akio Morita | no | Inventors & Engineers | East Asia | Japanese electronics entrepreneur | Akio Morita |
| `pub-alberto-santos-dumont` | Alberto Santos-Dumont | no | Inventors & Engineers | Latin America & Caribbean | Brazilian aviation pioneer | Alberto Santos-Dumont |
| `pub-aliko-dangote` | Aliko Dangote | yes | Inventors & Engineers | Sub-Saharan Africa | Nigerian industrialist | Aliko Dangote |
| `pub-bill-gates` | Bill Gates | yes | Inventors & Engineers | North America | American software entrepreneur and philanthropist | Bill Gates |
| `pub-elon-musk` | Elon Musk | yes | Inventors & Engineers | North America | South African-born American entrepreneur | Elon Musk |
| `pub-erno-rubik` | Ernő Rubik | yes | Inventors & Engineers | Europe | Hungarian inventor and architect | Ernő Rubik |
| `pub-grace-hopper` | Grace Hopper | no | Inventors & Engineers | North America | American computer scientist | Grace Hopper |
| `pub-jeff-bezos` | Jeff Bezos | yes | Inventors & Engineers | North America | American internet entrepreneur | Jeff Bezos |
| `pub-mo-ibrahim` | Mo Ibrahim | yes | Inventors & Engineers | Sub-Saharan Africa | Sudanese-British telecommunications entrepreneur | Mo Ibrahim |
| `pub-nikola-tesla` | Nikola Tesla | no | Inventors & Engineers | Europe | Serbian-American inventor and engineer | Nikola Tesla |
| `pub-ratan-tata` | Ratan Tata | no | Inventors & Engineers | South Asia | Indian industrialist | Ratan Tata |
| `pub-shuji-nakamura` | Shuji Nakamura | yes | Inventors & Engineers | East Asia | Japanese-American electronic engineer | Shuji Nakamura |
| `pub-steve-jobs` | Steve Jobs | no | Inventors & Engineers | North America | American technology entrepreneur | Steve Jobs |
| `pub-thomas-edison` | Thomas Edison | no | Inventors & Engineers | North America | American inventor | Thomas Edison |
| `pub-tim-berners-lee` | Tim Berners-Lee | yes | Inventors & Engineers | Europe | English computer scientist | Tim Berners-Lee |
| `pub-agatha-christie` | Agatha Christie | no | Authors & Poets | Europe | English crime novelist | Agatha Christie |
| `pub-aleksandr-solzhenitsyn` | Aleksandr Solzhenitsyn | no | Authors & Poets | Europe | Russian novelist | Aleksandr Solzhenitsyn |
| `pub-chimamanda-ngozi-adichie` | Chimamanda Ngozi Adichie | yes | Authors & Poets | Sub-Saharan Africa | Nigerian writer | Chimamanda Ngozi Adichie |
| `pub-chinua-achebe` | Chinua Achebe | no | Authors & Poets | Sub-Saharan Africa | Nigerian novelist | Chinua Achebe |
| `pub-ernest-hemingway` | Ernest Hemingway | no | Authors & Poets | North America | American novelist | Ernest Hemingway |
| `pub-f-sionil-jose` | F. Sionil José | no | Authors & Poets | Southeast Asia | Filipino novelist | F. Sionil José |
| `pub-gabriel-garcia-marquez` | Gabriel García Márquez | no | Authors & Poets | Latin America & Caribbean | Colombian novelist | Gabriel García Márquez |
| `pub-george-orwell` | George Orwell | no | Authors & Poets | Europe | English novelist and essayist | George Orwell |
| `pub-han-kang` | Han Kang | yes | Authors & Poets | East Asia | South Korean novelist | Han Kang |
| `pub-haruki-murakami` | Haruki Murakami | yes | Authors & Poets | East Asia | Japanese novelist | Haruki Murakami |
| `pub-isabel-allende` | Isabel Allende | yes | Authors & Poets | Latin America & Caribbean | Chilean-American writer | Isabel Allende |
| `pub-j-k-rowling` | J. K. Rowling | yes | Authors & Poets | Europe | British author | J. K. Rowling |
| `pub-j-r-r-tolkien` | J. R. R. Tolkien | no | Authors & Poets | Europe | English writer and philologist | J. R. R. Tolkien |
| `pub-jorge-luis-borges` | Jorge Luis Borges | no | Authors & Poets | Latin America & Caribbean | Argentine writer | Jorge Luis Borges |
| `pub-lu-xun` | Lu Xun | no | Authors & Poets | East Asia | Chinese writer | Lu Xun |
| `pub-mahmoud-darwish` | Mahmoud Darwish | no | Authors & Poets | Middle East & North Africa | Palestinian poet | Mahmoud Darwish |
| `pub-margaret-atwood` | Margaret Atwood | yes | Authors & Poets | North America | Canadian novelist and poet | Margaret Atwood |
| `pub-maya-angelou` | Maya Angelou | no | Authors & Poets | North America | American poet and memoirist | Maya Angelou |
| `pub-mo-yan` | Mo Yan | yes | Authors & Poets | East Asia | Chinese novelist | Mo Yan |
| `pub-nadine-gordimer` | Nadine Gordimer | no | Authors & Poets | Sub-Saharan Africa | South African writer | Nadine Gordimer |
| `pub-naguib-mahfouz` | Naguib Mahfouz | no | Authors & Poets | Middle East & North Africa | Egyptian novelist | Naguib Mahfouz |
| `pub-ngugi-wa-thiong-o` | Ngũgĩ wa Thiong'o | no | Authors & Poets | Sub-Saharan Africa | Kenyan writer | Ngũgĩ wa Thiong'o |
| `pub-orhan-pamuk` | Orhan Pamuk | yes | Authors & Poets | Middle East & North Africa | Turkish novelist | Orhan Pamuk |
| `pub-pablo-neruda` | Pablo Neruda | no | Authors & Poets | Latin America & Caribbean | Chilean poet | Pablo Neruda |
| `pub-patrick-white` | Patrick White | no | Authors & Poets | Oceania | Australian novelist | Patrick White |
| `pub-paulo-coelho` | Paulo Coelho | yes | Authors & Poets | Latin America & Caribbean | Brazilian novelist | Paulo Coelho |
| `pub-pramoedya-ananta-toer` | Pramoedya Ananta Toer | no | Authors & Poets | Southeast Asia | Indonesian novelist | Pramoedya Ananta Toer |
| `pub-rabindranath-tagore` | Rabindranath Tagore | no | Authors & Poets | South Asia | Bengali poet and polymath | Rabindranath Tagore |
| `pub-salman-rushdie` | Salman Rushdie | yes | Authors & Poets | South Asia | Indian-born British-American novelist | Salman Rushdie |
| `pub-stephen-king` | Stephen King | yes | Authors & Poets | North America | American author | Stephen King |
| `pub-toni-morrison` | Toni Morrison | no | Authors & Poets | North America | American novelist | Toni Morrison |
| `pub-virginia-woolf` | Virginia Woolf | no | Authors & Poets | Europe | English writer | Virginia Woolf |
| `pub-bertrand-russell` | Bertrand Russell | no | Philosophers & Thinkers | Europe | British philosopher and logician | Bertrand Russell |
| `pub-edward-said` | Edward Said | no | Philosophers & Thinkers | Middle East & North Africa | Palestinian-American literary critic | Edward Said |
| `pub-frantz-fanon` | Frantz Fanon | no | Philosophers & Thinkers | Latin America & Caribbean | Martinican psychiatrist and political philosopher | Frantz Fanon |
| `pub-friedrich-hayek` | Friedrich Hayek | no | Philosophers & Thinkers | Europe | Austrian-British economist and philosopher | Friedrich Hayek |
| `pub-hannah-arendt` | Hannah Arendt | no | Philosophers & Thinkers | Europe | German-American political theorist | Hannah Arendt |
| `pub-jean-paul-sartre` | Jean-Paul Sartre | no | Philosophers & Thinkers | Europe | French philosopher and writer | Jean-Paul Sartre |
| `pub-john-maynard-keynes` | John Maynard Keynes | no | Philosophers & Thinkers | Europe | English economist | John Maynard Keynes |
| `pub-john-rawls` | John Rawls | no | Philosophers & Thinkers | North America | American political philosopher | John Rawls |
| `pub-kwame-anthony-appiah` | Kwame Anthony Appiah | yes | Philosophers & Thinkers | Sub-Saharan Africa | British-Ghanaian philosopher | Kwame Anthony Appiah |
| `pub-martha-nussbaum` | Martha Nussbaum | yes | Philosophers & Thinkers | North America | American philosopher | Martha Nussbaum |
| `pub-milton-friedman` | Milton Friedman | no | Philosophers & Thinkers | North America | American economist | Milton Friedman |
| `pub-muhammad-iqbal` | Muhammad Iqbal | no | Philosophers & Thinkers | South Asia | South Asian poet and philosopher | Muhammad Iqbal |
| `pub-paulo-freire` | Paulo Freire | no | Philosophers & Thinkers | Latin America & Caribbean | Brazilian educator and philosopher | Paulo Freire |
| `pub-peter-singer` | Peter Singer | yes | Philosophers & Thinkers | Oceania | Australian moral philosopher | Peter Singer |
| `pub-sarvepalli-radhakrishnan` | Sarvepalli Radhakrishnan | no | Philosophers & Thinkers | South Asia | Indian philosopher and 2nd President of India | Sarvepalli Radhakrishnan |
| `pub-simone-de-beauvoir` | Simone de Beauvoir | no | Philosophers & Thinkers | Europe | French philosopher and writer | Simone de Beauvoir |
| `pub-amelia-earhart` | Amelia Earhart | no | Explorers & Travellers | North America | American aviator | Amelia Earhart |
| `pub-anousheh-ansari` | Anousheh Ansari | yes | Explorers & Travellers | Middle East & North Africa | Iranian-American engineer and space traveller | Anousheh Ansari |
| `pub-edmund-hillary` | Edmund Hillary | no | Explorers & Travellers | Oceania | New Zealand mountaineer | Edmund Hillary |
| `pub-franklin-chang-diaz` | Franklin Chang Díaz | yes | Explorers & Travellers | Latin America & Caribbean | Costa Rican-American astronaut | Franklin Chang Díaz |
| `pub-jacques-cousteau` | Jacques Cousteau | no | Explorers & Travellers | Europe | French oceanographer | Jacques Cousteau |
| `pub-junko-tabei` | Junko Tabei | no | Explorers & Travellers | East Asia | Japanese mountaineer | Junko Tabei |
| `pub-kalpana-chawla` | Kalpana Chawla | no | Explorers & Travellers | South Asia | Indian-American astronaut | Kalpana Chawla |
| `pub-mae-jemison` | Mae Jemison | yes | Explorers & Travellers | North America | American astronaut and physician | Mae Jemison |
| `pub-neil-armstrong` | Neil Armstrong | no | Explorers & Travellers | North America | American astronaut | Neil Armstrong |
| `pub-pham-tuan` | Phạm Tuân | yes | Explorers & Travellers | Southeast Asia | Vietnamese cosmonaut | Phạm Tuân |
| `pub-reinhold-messner` | Reinhold Messner | yes | Explorers & Travellers | Europe | Italian mountaineer | Reinhold Messner |
| `pub-sally-ride` | Sally Ride | no | Explorers & Travellers | North America | American astronaut and physicist | Sally Ride |
| `pub-tenzing-norgay` | Tenzing Norgay | no | Explorers & Travellers | South Asia | Nepali-Indian Sherpa mountaineer | Tenzing Norgay |
| `pub-tokhtar-aubakirov` | Tokhtar Aubakirov | yes | Explorers & Travellers | Central Asia | Kazakh cosmonaut | Tokhtar Aubakirov |
| `pub-valentina-tereshkova` | Valentina Tereshkova | yes | Explorers & Travellers | Europe | Soviet cosmonaut | Valentina Tereshkova |
| `pub-yang-liwei` | Yang Liwei | yes | Explorers & Travellers | East Asia | Chinese astronaut | Yang Liwei |
| `pub-yuri-gagarin` | Yuri Gagarin | no | Explorers & Travellers | Europe | Soviet cosmonaut | Yuri Gagarin |
| `pub-abebe-bikila` | Abebe Bikila | no | Athletes | Sub-Saharan Africa | Ethiopian marathon runner | Abebe Bikila |
| `pub-ayrton-senna` | Ayrton Senna | no | Athletes | Latin America & Caribbean | Brazilian racing driver | Ayrton Senna |
| `pub-cathy-freeman` | Cathy Freeman | yes | Athletes | Oceania | Australian sprinter | Cathy Freeman |
| `pub-cristiano-ronaldo` | Cristiano Ronaldo | yes | Athletes | Europe | Portuguese footballer | Cristiano Ronaldo |
| `pub-didier-drogba` | Didier Drogba | yes | Athletes | Sub-Saharan Africa | Ivorian footballer | Didier Drogba |
| `pub-diego-maradona` | Diego Maradona | no | Athletes | Latin America & Caribbean | Argentine footballer | Diego Maradona |
| `pub-don-bradman` | Don Bradman | no | Athletes | Oceania | Australian cricketer | Don Bradman |
| `pub-eliud-kipchoge` | Eliud Kipchoge | yes | Athletes | Sub-Saharan Africa | Kenyan marathon runner | Eliud Kipchoge |
| `pub-gennady-golovkin` | Gennady Golovkin | yes | Athletes | Central Asia | Kazakh boxer | Gennady Golovkin |
| `pub-haile-gebrselassie` | Haile Gebrselassie | yes | Athletes | Sub-Saharan Africa | Ethiopian long-distance runner | Haile Gebrselassie |
| `pub-hakuho-sho` | Hakuhō Shō | yes | Athletes | Central Asia | Mongolian-born sumo wrestler | Hakuhō Shō |
| `pub-hicham-el-guerrouj` | Hicham El Guerrouj | yes | Athletes | Middle East & North Africa | Moroccan middle-distance runner | Hicham El Guerrouj |
| `pub-jackie-robinson` | Jackie Robinson | no | Athletes | North America | American baseball player | Jackie Robinson |
| `pub-jesse-owens` | Jesse Owens | no | Athletes | North America | American track and field athlete | Jesse Owens |
| `pub-jonah-lomu` | Jonah Lomu | no | Athletes | Oceania | New Zealand rugby union player | Jonah Lomu |
| `pub-lebron-james` | LeBron James ★ | yes | Athletes | North America | American basketball player | LeBron James |
| `pub-lee-chong-wei` | Lee Chong Wei | yes | Athletes | Southeast Asia | Malaysian badminton player | Lee Chong Wei |
| `pub-lewis-hamilton` | Lewis Hamilton | yes | Athletes | Europe | British racing driver | Lewis Hamilton |
| `pub-li-na` | Li Na | yes | Athletes | East Asia | Chinese tennis player | Li Na |
| `pub-lionel-messi` | Lionel Messi | yes | Athletes | Latin America & Caribbean | Argentine footballer | Lionel Messi |
| `pub-manny-pacquiao` | Manny Pacquiao | yes | Athletes | Southeast Asia | Filipino boxer | Manny Pacquiao |
| `pub-marta` | Marta | yes | Athletes | Latin America & Caribbean | Brazilian footballer | Marta (footballer) |
| `pub-michael-jordan` | Michael Jordan ★ | yes | Athletes | North America | American basketball player | Michael Jordan |
| `pub-michael-phelps` | Michael Phelps | yes | Athletes | North America | American swimmer | Michael Phelps |
| `pub-mohamed-salah` | Mohamed Salah | yes | Athletes | Middle East & North Africa | Egyptian footballer | Mohamed Salah |
| `pub-muhammad-ali` | Muhammad Ali | no | Athletes | North America | American boxer | Muhammad Ali |
| `pub-muttiah-muralitharan` | Muttiah Muralitharan | yes | Athletes | South Asia | Sri Lankan cricketer | Muttiah Muralitharan |
| `pub-nadia-comaneci` | Nadia Comăneci | yes | Athletes | Europe | Romanian gymnast | Nadia Comăneci |
| `pub-naomi-osaka` | Naomi Osaka | yes | Athletes | East Asia | Japanese tennis player | Naomi Osaka |
| `pub-neeraj-chopra` | Neeraj Chopra | yes | Athletes | South Asia | Indian javelin thrower | Neeraj Chopra |
| `pub-novak-djokovic` | Novak Djokovic | yes | Athletes | Europe | Serbian tennis player | Novak Djokovic |
| `pub-pele` | Pelé | no | Athletes | Latin America & Caribbean | Brazilian footballer | Pelé |
| `pub-rafael-nadal` | Rafael Nadal | yes | Athletes | Europe | Spanish tennis player | Rafael Nadal |
| `pub-roger-federer` | Roger Federer | yes | Athletes | Europe | Swiss tennis player | Roger Federer |
| `pub-sachin-tendulkar` | Sachin Tendulkar | yes | Athletes | South Asia | Indian cricketer | Sachin Tendulkar |
| `pub-serena-williams` | Serena Williams ★ | yes | Athletes | North America | American tennis player | Serena Williams |
| `pub-shelly-ann-fraser-pryce` | Shelly-Ann Fraser-Pryce | yes | Athletes | Latin America & Caribbean | Jamaican sprinter | Shelly-Ann Fraser-Pryce |
| `pub-shohei-ohtani` | Shohei Ohtani | yes | Athletes | East Asia | Japanese baseball player | Shohei Ohtani |
| `pub-simone-biles` | Simone Biles | yes | Athletes | North America | American gymnast | Simone Biles |
| `pub-son-heung-min` | Son Heung-min | yes | Athletes | East Asia | South Korean footballer | Son Heung-min |
| `pub-tiger-woods` | Tiger Woods | yes | Athletes | North America | American golfer | Tiger Woods |
| `pub-tom-brady` | Tom Brady | yes | Athletes | North America | American football quarterback | Tom Brady |
| `pub-usain-bolt` | Usain Bolt | yes | Athletes | Latin America & Caribbean | Jamaican sprinter | Usain Bolt |
| `pub-valerie-adams` | Valerie Adams | yes | Athletes | Oceania | New Zealand shot putter | Valerie Adams |
| `pub-virat-kohli` | Virat Kohli | yes | Athletes | South Asia | Indian cricketer | Virat Kohli |
| `pub-wayne-gretzky` | Wayne Gretzky | yes | Athletes | North America | Canadian ice hockey player | Wayne Gretzky |
| `pub-yao-ming` | Yao Ming | yes | Athletes | East Asia | Chinese basketball player | Yao Ming |
| `pub-zinedine-zidane` | Zinedine Zidane | yes | Athletes | Europe | French footballer and coach | Zinedine Zidane |
| `pub-bassem-amin` | Bassem Amin | yes | Chess Masters | Middle East & North Africa | Egyptian chess grandmaster | Bassem Amin |
| `pub-bobby-fischer` | Bobby Fischer | no | Chess Masters | North America | American chess grandmaster | Bobby Fischer |
| `pub-ding-liren` | Ding Liren | yes | Chess Masters | East Asia | Chinese chess grandmaster | Ding Liren |
| `pub-garry-kasparov` | Garry Kasparov | yes | Chess Masters | Europe | Russian-born chess grandmaster | Garry Kasparov |
| `pub-hikaru-nakamura` | Hikaru Nakamura | yes | Chess Masters | North America | American chess grandmaster | Hikaru Nakamura |
| `pub-hou-yifan` | Hou Yifan | yes | Chess Masters | East Asia | Chinese chess grandmaster | Hou Yifan |
| `pub-jose-raul-capablanca` | José Raúl Capablanca | no | Chess Masters | Latin America & Caribbean | Cuban chess world champion | José Raúl Capablanca |
| `pub-judit-polgar` | Judit Polgár | yes | Chess Masters | Europe | Hungarian chess grandmaster | Judit Polgár |
| `pub-magnus-carlsen` | Magnus Carlsen | yes | Chess Masters | Europe | Norwegian chess grandmaster | Magnus Carlsen |
| `pub-mikhail-tal` | Mikhail Tal | no | Chess Masters | Europe | Latvian-Soviet chess grandmaster | Mikhail Tal |
| `pub-nona-gaprindashvili` | Nona Gaprindashvili | yes | Chess Masters | Europe | Georgian chess grandmaster | Nona Gaprindashvili |
| `pub-rustam-kasimdzhanov` | Rustam Kasimdzhanov | yes | Chess Masters | Central Asia | Uzbek chess grandmaster | Rustam Kasimdzhanov |
| `pub-viswanathan-anand` | Viswanathan Anand | yes | Chess Masters | South Asia | Indian chess grandmaster | Viswanathan Anand |
| `pub-wesley-so` | Wesley So | yes | Chess Masters | Southeast Asia | Filipino-American chess grandmaster | Wesley So |
| `pub-diana-princess-of-wales` | Diana, Princess of Wales | no | Reformers & Other Cultural Figures | Europe | Member of the British royal family | Diana, Princess of Wales |
| `pub-eleanor-roosevelt` | Eleanor Roosevelt | no | Reformers & Other Cultural Figures | North America | American diplomat and activist | Eleanor Roosevelt |
| `pub-fred-hollows` | Fred Hollows | no | Reformers & Other Cultural Figures | Oceania | New Zealand-Australian ophthalmologist | Fred Hollows |
| `pub-irena-sendler` | Irena Sendler | no | Reformers & Other Cultural Figures | Europe | Polish humanitarian and social worker | Irena Sendler |
| `pub-malala-yousafzai` | Malala Yousafzai | yes | Reformers & Other Cultural Figures | South Asia | Pakistani education activist | Malala Yousafzai |
| `pub-martin-luther-king-jr` | Martin Luther King Jr. | no | Reformers & Other Cultural Figures | North America | American civil rights leader | Martin Luther King Jr. |
| `pub-muhammad-yunus` | Muhammad Yunus | yes | Reformers & Other Cultural Figures | South Asia | Bangladeshi economist and social entrepreneur | Muhammad Yunus |
| `pub-rigoberta-menchu` | Rigoberta Menchú | yes | Reformers & Other Cultural Figures | Latin America & Caribbean | Guatemalan Indigenous rights activist | Rigoberta Menchú |
| `pub-rosa-parks` | Rosa Parks | no | Reformers & Other Cultural Figures | North America | American civil rights activist | Rosa Parks |
| `pub-ruth-bader-ginsburg` | Ruth Bader Ginsburg | no | Reformers & Other Cultural Figures | North America | Associate Justice of the US Supreme Court | Ruth Bader Ginsburg |
| `pub-shirin-ebadi` | Shirin Ebadi | yes | Reformers & Other Cultural Figures | Middle East & North Africa | Iranian lawyer and human rights activist | Shirin Ebadi |
| `pub-tawakkol-karman` | Tawakkol Karman | yes | Reformers & Other Cultural Figures | Middle East & North Africa | Yemeni journalist and activist | Tawakkol Karman |
| `pub-wangari-maathai` | Wangari Maathai | no | Reformers & Other Cultural Figures | Sub-Saharan Africa | Kenyan environmental activist | Wangari Maathai |
| `pub-warren-buffett` | Warren Buffett | yes | Reformers & Other Cultural Figures | North America | American investor | Warren Buffett |

<!-- roster:contemporary:end -->
