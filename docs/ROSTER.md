# Historical roster (crown-roster-1)

Owner request, v0.10 Decision 2 (docs/V10_PLAN.md). Part of the Federation's population carries the names of
historical figures as **clearly fictional chess personas**. This file is the policy, the exclusion list and the
provenance record for every identity. Data: `src/federation/rosterIdentities.json`. Logic:
`src/federation/rosterPersonas.ts`. Tests: `tests/roster.test.ts`.

## Policy

* **Inclusion rule.** Only historical figures who **died in 1925 or earlier** (more than 100 years before 2026). This
  stays clear of post-mortem personality and publicity rights (which last up to 100 years after death in some
  jurisdictions) and of any suggestion that a living person plays, endorses or is depicted by the game.
* **Fictional personas.** A persona is a name laid over a competitor the population generator has already made.
  Rating, hidden strength, playing style, Federation region, division, age, career, titles and results come from the
  seeded generator and the simulation. They are assigned **independently of the person** (by seeded hashes of the world
  seed and competitor id), never by fame, nationality, politics or any other trait, and say nothing about the real
  person. The in-game note reads: *"Historical figures appear as fictional chess personas. Their ratings, styles and
  results are invented and say nothing about the real people."* It is shown on every persona's profile and in the
  competitor browser.
* **No likenesses.** No photographs, paintings, likenesses, signatures or logos. Personas use the same original,
  procedurally generated pixel portraits and heraldic insignias as every other competitor.
* **Federation region is not the person's homeland.** The Federation's regions (Ashmere, Brightwater, …) are
  invented. The `region` field below records the person's real-world region, for provenance and to keep the roster
  global; it is not used to place the persona.
* **Accuracy before count.** An identity is included only when its name, lifespan and reference are well
  established. Where a year is uncertain the record is marked *c.* (circa). Years are Gregorian; negative years are BC.
  Names that are ambiguous carry their common disambiguator (e.g. *Johann Strauss II*), and the reference is the
  English Wikipedia article title.

## How personas enter a Federation

* **Existing federations keep every competitor's name and id.** Nothing already stored is renamed, and loading an
  older save never adds a persona to an existing competitor.
* **New federations:** when a federation is founded, 8% of its competitors (164 of 2,048) carry a persona, capped at
  60% of the roster so that later entrants can still bring new identities. The rest keep original generated names.
* **Turnover (every federation, old and new):** each new entrant that replaces a retirement at a season's end has a
  12% seeded chance of carrying the next unused identity. Identities are never reused within a world, even after
  their competitor retires.
* Everything is deterministic for a world seed. Each competitor record holds `persona: <identity id>`; the UI uses it
  to show the *Historical persona (fictional)* label, lifespan and descriptor.

## Not used, and why

| Who | Reason | Original alternative |
|---|---|---|
| Living people, e.g. Taylor Swift, Beyoncé, Serena Williams, Magnus Carlsen, Lionel Messi, LeBron James, and any current politician | Living people have rights of publicity and their consent is not given; the game must not imply that they play, endorse or are depicted by it | Original generated names |
| Albert Einstein (d. 1955) | Died after 1925; his name is commercially licensed by his estate | Original names; earlier physicists such as Michael Faraday or James Clerk Maxwell are in the roster |
| Marie Curie (d. 1934) | Died after 1925 | Pierre Curie (d. 1906) is in the roster; Ada Lovelace, Caroline Herschel and other earlier scientists |
| Others who died after 1925, e.g. Claude Monet (1926), Harry Houdini (1926), Annie Oakley (1926), Antoni Gaudí (1926), Rudolph Valentino (1926), Rainer Maria Rilke (1926), Mary Cassatt (1926), Gertrude Bell (1926), Bessie Coleman (1926), Fred Spofforth (1926), Camillo Golgi (1926), Thomas Edison (1931), Nikola Tesla (1943), Mahatma Gandhi (1948), Emanuel Lasker (1941), Siegbert Tarrasch (1934) | Died after 1925 (several in 1926, just outside the rule) | Earlier figures in the same fields |
| Figures known primarily for atrocities, e.g. Adolf Hitler, Joseph Stalin, Pol Pot, Genghis Khan, Timur, Attila, Vlad the Impaler, Ivan the Terrible, Caligula, Nero, Leopold II of Belgium, Ranavalona I, Christopher Columbus, Hernán Cortés, Francisco Pizarro, Vasco da Gama, Henry Morton Stanley, Cecil Rhodes, Andrew Jackson | Known primarily for mass killing, conquest or colonial brutality | — |
| Conquerors whose fame rests on wars of conquest, e.g. Alexander the Great, Julius Caesar, Napoleon | Left out conservatively | — |
| Religious founders and figures of worship, e.g. Jesus, Muhammad, Gautama Buddha, Moses, Zoroaster, Confucius, Laozi, Guru Nanak, Martin Luther, Pythagoras; saints and venerated figures, e.g. Joan of Arc, Francis of Assisi, Hildegard of Bingen, Thomas Aquinas, Mary MacKillop, Rumi, Kabir; rulers worshipped or enshrined as divine, e.g. Emperor Meiji, Chulalongkorn, Augustus; founders of religious movements, e.g. Akbar (Din-i Ilahi), Auguste Comte (Religion of Humanity), Ram Mohan Roy; clergy known as such, e.g. Miguel Hidalgo, Sor Juana Inés de la Cruz | Religious founders, objects of worship or veneration | — |
| Serious crimes or contested legacies, e.g. Juan Luna and Max Linder (killed their wives), Caravaggio (killed a man), Paul Gauguin, Egon Schiele, Richard Wagner, P. T. Barnum, Cap Anson, Ned Kelly, Mata Hari, Jean-Jacques Dessalines, Tipu Sultan | Left out conservatively; a chess persona should not invite controversy about the person | — |
| People remembered mainly for suffering or martyrdom, e.g. Truganini, Yu Gwan-sun, Sacagawea, General Tom Thumb | Left out out of respect | — |

### Considered and left out because a fact could not be confirmed with confidence

Gioachino Greco, Ruy López de Segura and Pedro Damiano (uncertain lifespans), Euclid, Homer, Sappho, Aesop,
Hypatia, Murasaki Shikibu and Sei Shōnagon (uncertain or legendary lifespans), Pierre de Fermat (disputed birth year),
Florentino Ameghino (birth year given as 1853 or 1854), Alexander Hamilton (disputed birth year), Hatshepsut,
Ashoka, Mansa Musa, Nzinga of Ndongo and Matamba, Kamehameha I, Lakshmibai (Rani of Jhansi, disputed birth year),
Tyagaraja and Muthuswami Dikshitar (venerated as saints), Antonio Maceo, Rachel Félix, Mademoiselle Mars, Vernon
Castle, the Montgolfier brothers, Francis Bacon (shares a name with a 20th-century painter) and Bai Bureh, Almeida
Júnior (reference titles not certain). They can be added later if a reviewer confirms the record.

## Roster

<!-- roster:generated:begin -->

**407 identities.** Generated from `src/federation/rosterIdentities.json` by `npx tsx tools/roster/gen-doc.mts`; do not edit by hand.

| Category | Identities |
|---|---:|
| Leaders & Statespeople | 52 |
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
| Europe | 171 |
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
| `hist-abraham-lincoln` | Abraham Lincoln | 1809–1865 | Leaders & Statespeople | North America | 16th President of the United States | Abraham Lincoln |
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
| `hist-leonardo-da-vinci` | Leonardo da Vinci | 1452–1519 | Artists & Architects | Europe | Italian Renaissance painter and polymath | Leonardo da Vinci |
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
| `hist-vincent-van-gogh` | Vincent van Gogh | 1853–1890 | Artists & Architects | Europe | Dutch Post-Impressionist painter | Vincent van Gogh |
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
| `hist-isaac-newton` | Isaac Newton | 1643–1727 | Scientists & Mathematicians | Europe | English mathematician and physicist | Isaac Newton |
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
